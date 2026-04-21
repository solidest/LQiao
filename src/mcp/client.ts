import type { MCPServerConfig, MCPTool, MCPToolResult, MCPState } from '../types/mcp';
import { StdioTransport } from './transports/stdio';
import { SSETransport } from './transports/sse';
import { EventEmitter } from 'node:events';

/**
 * MCP client: manages connection lifecycle, tool discovery, and tool calls.
 * Wraps either Stdio or SSE transport to communicate with MCP servers.
 */
export class MCPClient extends EventEmitter {
  #config: MCPServerConfig;
  #state: MCPState = 'disconnected';
  #stdio?: StdioTransport;
  #sse?: SSETransport;
  #tools: MCPTool[] = [];

  constructor(config: MCPServerConfig) {
    super();
    this.#config = config;
  }

  /** Connect to the MCP server and discover tools */
  async connect(): Promise<void> {
    this.#setState('connecting');

    const timeoutMs = this.#config.timeout ?? 30000;
    const transport = this.#config.transport ?? 'stdio';

    try {
      if (transport === 'stdio') {
        this.#stdio = new StdioTransport();
        await this.#stdio.connect({
          command: this.#config.command,
          args: this.#config.args,
          env: this.#config.env,
        });
      } else {
        this.#sse = new SSETransport(timeoutMs);
        const sseUrl = this.#config.sseUrl;
        if (!sseUrl) {
          throw new Error('SSE transport requires sseUrl');
        }
        await this.#sse.connect(sseUrl);
      }

      // Initialize the MCP session
      await this.#request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'lqiao', version: '0.1.0' },
      }, undefined, timeoutMs);

      await this.#discoverTools(timeoutMs);
      this.#setState('connected');
    } catch (error) {
      this.#setState('error');
      throw error;
    }
  }

  /** Disconnect from the MCP server */
  async disconnect(): Promise<void> {
    await this.#stdio?.disconnect();
    await this.#sse?.disconnect();
    this.#stdio = undefined;
    this.#sse = undefined;
    this.#tools = [];
    this.#setState('disconnected');
  }

  /** Get discovered tools */
  getTools(): MCPTool[] {
    return [...this.#tools];
  }

  /** Call an MCP tool by name */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.#request('tools/call', { name, arguments: args }, undefined, this.#config.timeout);
    return result as MCPToolResult;
  }

  /** Check if the client is connected */
  get isConnected(): boolean {
    return this.#state === 'connected';
  }

  /** Get current connection state */
  get state(): MCPState {
    return this.#state;
  }

  get serverConfig(): Readonly<MCPServerConfig> {
    return { ...this.#config };
  }

  #setState(state: MCPState): void {
    this.#state = state;
    this.emit('stateChange', { state, serverName: this.#config.command, toolsFound: this.#tools.length });
  }

  async #discoverTools(timeoutMs: number): Promise<void> {
    const result = await this.#request('tools/list', undefined, undefined, timeoutMs);
    const tools = (result as { tools: MCPTool[] })?.tools ?? [];
    this.#tools = tools;
    this.emit('toolsDiscovered', { tools: this.#tools.length });
  }

  async #request(method: string, params?: Record<string, unknown>, _signal?: AbortSignal, timeoutMs = 30000): Promise<unknown> {
    const transport = this.#stdio ?? this.#sse;
    if (!transport) {
      throw new Error('No transport available');
    }
    return transport.request(method, params, timeoutMs);
  }
}
