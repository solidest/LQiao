import type { Tool } from '../types/tool';

/** Tool registry — manages available tools for agents */
export class ToolRegistry {
  #tools = new Map<string, Tool>();

  /** Register a tool by its name */
  register(tool: Tool): void {
    this.#tools.set(tool.name, tool);
  }

  /** Register multiple tools at once */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Get a tool by name */
  get(name: string): Tool | undefined {
    return this.#tools.get(name);
  }

  /** List all registered tools */
  list(): Tool[] {
    return Array.from(this.#tools.values());
  }

  /** Remove a tool by name */
  remove(name: string): void {
    this.#tools.delete(name);
  }

  /** Get the number of registered tools */
  get size(): number {
    return this.#tools.size;
  }

  /** Check if a tool is registered */
  has(name: string): boolean {
    return this.#tools.has(name);
  }
}
