import type { MCPServerConfig, MCPTool, MCPToolResult, MCPState, MCPEventData } from '../types/mcp';
import { StdioTransport } from './transports/stdio';
import { SSETransport } from './transports/sse';
import { EventEmitter } from 'node:events';

/** MCP protocol version used for initialization */
const MCP_PROTOCOL_VERSION = '2024-11-05';

/** LQiao client info sent during initialization */
const CLIENT_INFO = { name: 'lqiao', version: '0.1.0' };

/** MCPClient event names — use these for typed event handling */
export const MCP_EVENTS = {
  STATE_CHANGE: 'stateChange',
  TOOLS_DISCOVERED: 'toolsDiscovered',
} as const;

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
        this.#sse = new SSETransport({ connectTimeout: timeoutMs });
        const sseUrl = this.#config.sseUrl;
        if (!sseUrl) {
          throw new Error('SSE transport requires sseUrl');
        }
        await this.#sse.connect(sseUrl);
      }

      // Initialize the MCP session
      await this.#request('initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      }, timeoutMs);

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
    const result = await this.#request('tools/call', { name, arguments: args }, this.#config.timeout);
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
    const serverName = this.#config.transport === 'sse'
      ? this.#config.sseUrl
      : this.#config.command;
    this.emit(MCP_EVENTS.STATE_CHANGE, { state, serverName, toolsFound: this.#tools.length } as MCPEventData);
  }

  async #discoverTools(timeoutMs: number): Promise<void> {
    const result = await this.#request('tools/list', undefined, timeoutMs);
    const tools = (result as { tools: MCPTool[] })?.tools ?? [];
    this.#tools = tools;
    this.emit(MCP_EVENTS.TOOLS_DISCOVERED, { tools: this.#tools.length });
  }

  async #request(method: string, params?: Record<string, unknown>, timeoutMs = 30000): Promise<unknown> {
    const transport = this.#stdio ?? this.#sse;
    if (!transport) {
      throw new Error('No transport available');
    }
    return transport.request(method, params, timeoutMs);
  }
}
