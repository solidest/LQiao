import type { AgentConfig } from '../types/agent';
import type { Tool } from '../types/tool';
import type { GenerateOptions, ModelResponse, StreamChunk } from '../types/model';
import type { EventHandler } from '../types/event';
import type { Sandbox } from '../security/sandbox';
import type { MCPClient } from '../mcp/client';
import { DefaultEventBus } from './event-bus';
import { ReactAgent } from './react-agent';
import { modelRegistry } from '../model/registry';
import { Sandbox as SandboxImpl } from '../security/sandbox';
import { MCPClient as MCPClientImpl } from '../mcp/client';
import { wrapMCPTools } from '../tools/mcp-tool';
import { createModelError } from '../errors/base';
import type { EventBus } from '../types/event';

/**
 * Main Agent class — aggregates model, tools, security, and events.
 */
export class Agent {
  #config: Required<Omit<AgentConfig, 'apiKey' | 'sandbox' | 'mcpServers'>> & {
    apiKey: string;
    sandbox: boolean | NonNullable<AgentConfig['sandbox']>;
    mcpServers: AgentConfig['mcpServers'];
  };

  #eventBus: EventBus;
  #sandbox?: Sandbox;
  #mcpClients: MCPClient[] = [];
  #mcpInitialized = false;

  constructor(config: AgentConfig) {
    this.#config = {
      model: config.model,
      apiKey: config.apiKey ?? '',
      tools: config.tools ?? [],
      mcpServers: config.mcpServers ?? [],
      sandbox: config.sandbox ?? false,
      maxSteps: config.maxSteps ?? 50,
      maxRetries: config.maxRetries ?? 3,
      verbose: config.verbose ?? false,
    };

    this.#eventBus = new DefaultEventBus();

    if (this.#config.sandbox) {
      const sandboxConfig = typeof this.#config.sandbox === 'object'
        ? this.#config.sandbox
        : {};
      this.#sandbox = new SandboxImpl(sandboxConfig);
    }
  }

  /** Initialize MCP server connections and discover tools */
  async initializeMCP(): Promise<void> {
    if (this.#mcpInitialized) return;
    const servers = this.#config.mcpServers;
    if (!servers || servers.length === 0) {
      this.#mcpInitialized = true;
      return;
    }

    const clients = servers.map((cfg) => new MCPClientImpl(cfg));
    await Promise.all(clients.map((c) => c.connect()));

    for (const client of clients) {
      const tools = wrapMCPTools(client);
      this.#config.tools.push(...tools);
    }

    this.#mcpClients = clients;
    this.#mcpInitialized = true;
  }

  /** Run a natural language task */
  async run(task: string): Promise<string> {
    if (!this.#mcpInitialized) {
      await this.initializeMCP();
    }

    this.#eventBus.emit('beforeRun', { task });

    const model = modelRegistry.create(
      typeof this.#config.model === 'string' ? this.#config.model : 'gpt-4o',
      this.#config.apiKey,
    );

    const reactAgent = new ReactAgent({
      tools: this.#config.tools,
      eventBus: this.#eventBus,
      maxSteps: this.#config.maxSteps,
      maxRetries: this.#config.maxRetries,
      sandbox: this.#sandbox,
    });

    try {
      const result = await reactAgent.run(
        (prompt, options) => model.generate(prompt, options),
        task,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#eventBus.emit('onError', { task, error: message });
      throw createModelError(`Agent run failed: ${message}`, { originalError: error });
    }
  }

  /**
   * Stream raw model output for a task.
   * Note: this bypasses the ReAct loop, tools, and sandbox.
   * Use for streaming-only model interactions, not agent-driven tasks.
   */
  async *stream(task: string): AsyncIterable<StreamChunk> {
    this.#eventBus.emit('beforeRun', { task, streaming: true });

    const model = modelRegistry.create(
      typeof this.#config.model === 'string' ? this.#config.model : 'gpt-4o',
      this.#config.apiKey,
    );

    yield* model.stream(task);
  }

  /** Register an event listener */
  on(event: string, handler: EventHandler): void {
    this.#eventBus.on(event, handler);
  }

  /** Remove an event listener */
  off(event: string, handler: EventHandler): void {
    this.#eventBus.off(event, handler);
  }

  /** Switch to a different model at runtime */
  switchModel(modelId: string, apiKey?: string): void {
    this.#config.model = modelId;
    if (apiKey) {
      this.#config.apiKey = apiKey;
    }
  }

  /** Get the event bus for advanced usage */
  get eventBus(): EventBus {
    return this.#eventBus;
  }

  /** Get current config */
  get config(): Readonly<AgentConfig> & { apiKey: string } {
    return { ...this.#config };
  }

  /** Get MCP clients for advanced usage */
  get mcpClients(): ReadonlyArray<MCPClient> {
    return [...this.#mcpClients];
  }

  /** Disconnect all MCP clients */
  async disconnectMCP(): Promise<void> {
    await Promise.all(this.#mcpClients.map((c) => c.disconnect()));
    this.#mcpClients = [];
  }
}
