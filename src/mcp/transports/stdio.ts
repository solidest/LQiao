import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface StdioTransportOptions {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Stdio transport for MCP: communicates with server via child process stdin/stdout.
 * Implements JSON-RPC 2.0 message framing (newline-delimited JSON).
 */
export class StdioTransport extends EventEmitter {
  #process?: ChildProcess;
  #buffer = '';
  #pending = new Map<number | string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  #id = 0;

  async connect(options: StdioTransportOptions): Promise<void> {
    const env = { ...process.env, ...options.env };
    this.#process = spawn(options.command, options.args, {
      stdio: ['pipe', 'pipe', 'inherit'],
      env,
    });

    this.#process.stdout?.on('data', (chunk: Buffer) => {
      this.#buffer += chunk.toString();
      this.#processBuffer();
    });

    this.#process.on('exit', (code) => {
      const error = new Error(`MCP server exited with code ${code ?? 'unknown'}`);
      for (const { reject } of this.#pending.values()) {
        reject(error);
      }
      this.#pending.clear();
      this.emit('close', code);
    });

    this.#process.on('error', (err) => {
      for (const { reject } of this.#pending.values()) {
        reject(err);
      }
      this.#pending.clear();
      this.emit('error', err);
    });
  }

  async request(method: string, params?: Record<string, unknown>, timeoutMs = 30000): Promise<unknown> {
    if (!this.#process?.stdin) {
      throw new Error('Transport not connected');
    }

    const id = ++this.#id;
    const message = { jsonrpc: '2.0', id, method, params };

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

      this.#process!.stdin!.write(JSON.stringify(message) + '\n');
    });
  }

  async disconnect(): Promise<void> {
    if (this.#process) {
      this.#process.stdin?.end();
      this.#process.kill();
      this.#process = undefined;
    }
    for (const { reject } of this.#pending.values()) {
      reject(new Error('Transport disconnected'));
    }
    this.#pending.clear();
  }

  get isConnected(): boolean {
    return this.#process !== undefined && !this.#process.killed;
  }

  #processBuffer(): void {
    while (true) {
      const idx = this.#buffer.indexOf('\n');
      if (idx === -1) break;

      const line = this.#buffer.slice(0, idx).trim();
      this.#buffer = this.#buffer.slice(idx + 1);
      if (!line) continue;

      try {
        const msg = JSON.parse(line);
        if ('id' in msg && this.#pending.has(msg.id)) {
          const { resolve, reject } = this.#pending.get(msg.id)!;
          this.#pending.delete(msg.id);
          if ('error' in msg) {
            reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch {
        // Skip non-JSON lines (stderr mixed in stdout)
      }
    }
  }
}
