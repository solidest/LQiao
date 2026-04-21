import { EventEmitter } from 'node:events';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

/** Max buffer size for SSE stream parsing (8KB) */
const MAX_BUFFER_SIZE = 8 * 1024;

/**
 * SSE transport for MCP: communicates via HTTP Server-Sent Events.
 * Connects to MCP server's SSE endpoint for receiving messages,
 * POSTs requests back to the server's message endpoint.
 */
export interface SSETransportConfig {
  /** Connection timeout in milliseconds (default: 30s) */
  connectTimeout?: number;
  /** Optional HTTP headers for POST requests (e.g. auth tokens) */
  headers?: Record<string, string>;
}

export class SSETransport extends EventEmitter {
  #messageUrl?: string;
  #abortController?: AbortController;
  #pending = new Map<number | string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  #id = 0;
  #config: SSETransportConfig;
  #streamEnded = false;
  #streamEndedNormally = false;

  constructor(config?: SSETransportConfig) {
    super();
    this.#config = config ?? {};
  }

  async connect(url: string): Promise<void> {
    this.#abortController = new AbortController();
    this.#streamEnded = false;

    return new Promise((resolve, reject) => {
      const connectTimer = setTimeout(() => {
        this.#abortController?.abort();
        reject(new Error('SSE connection timed out'));
      }, this.#config.connectTimeout ?? 30000);

      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(url, { signal: this.#abortController?.signal }, (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(connectTimer);
          reject(new Error(`SSE connection failed: HTTP ${res.statusCode}`));
          return;
        }

        let buffer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          // Prevent unbounded buffer growth
          if (buffer.length > MAX_BUFFER_SIZE) {
            buffer = buffer.slice(-MAX_BUFFER_SIZE);
          }

          while (true) {
            const idx = buffer.indexOf('\n');
            if (idx === -1) break;

            const line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);

            if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim();
              if (eventType === 'endpoint') {
                const dataIdx = buffer.indexOf('\n');
                if (dataIdx !== -1) {
                  const dataLine = buffer.slice(0, dataIdx);
                  if (dataLine.startsWith('data: ')) {
                    const endpoint = dataLine.slice(6).trim();
                    try {
                      this.#messageUrl = new URL(endpoint, url).href;
                    } catch {
                      this.#messageUrl = endpoint;
                    }
                  }
                  buffer = buffer.slice(dataIdx + 1);
                }
              }
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data && data !== '[DONE]') {
                try {
                  const msg = JSON.parse(data);
                  if ('id' in msg && this.#pending.has(msg.id)) {
                    const { resolve: r, reject: j } = this.#pending.get(msg.id)!;
                    this.#pending.delete(msg.id);
                    if ('error' in msg) {
                      j(new Error(msg.error.message ?? JSON.stringify(msg.error)));
                    } else {
                      r(msg.result);
                    }
                  }
                } catch {
                  // Skip non-JSON data
                }
              }
            }
          }
        });

        res.on('end', () => {
          clearTimeout(connectTimer);
          if (this.#messageUrl) {
            this.#streamEndedNormally = true;
            this.#streamEnded = true;
            resolve();
          } else {
            this.#streamEnded = true;
            reject(new Error('SSE stream ended without endpoint'));
          }
        });

        res.on('close', () => {
          clearTimeout(connectTimer);
          if (!this.#streamEndedNormally) {
            this.#streamEnded = true;
            for (const { reject: rej } of this.#pending.values()) {
              rej(new Error('SSE stream closed'));
            }
            this.#pending.clear();
            this.#messageUrl = undefined;
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(connectTimer);
        reject(err);
      });
    });
  }

  async request(method: string, params?: Record<string, unknown>, timeoutMs = 30000): Promise<unknown> {
    const messageUrl = this.#messageUrl;
    if (!messageUrl) {
      throw new Error('Transport not connected');
    }

    const id = ++this.#id;
    const message = { jsonrpc: '2.0', id, method, params };
    const body = JSON.stringify(message);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`Request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.#pending.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      const parsedUrl = new URL(messageUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
        ...this.#config.headers,
      };

      const req = client.request(messageUrl, { method: 'POST', headers }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk; });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            this.#pending.delete(id);
            clearTimeout(timer);
            reject(new Error(`POST failed: HTTP ${res.statusCode} ${data}`));
          }
          // On success, response arrives via SSE — no action needed here
        });
      });

      req.on('error', (err) => {
        this.#pending.delete(id);
        clearTimeout(timer);
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }

  async disconnect(): Promise<void> {
    this.#abortController?.abort();
    this.#abortController = undefined;
    for (const { reject: rej } of this.#pending.values()) {
      rej(new Error('Transport disconnected'));
    }
    this.#pending.clear();
    this.#messageUrl = undefined;
  }

  get isConnected(): boolean {
    return this.#messageUrl !== undefined;
  }
}
