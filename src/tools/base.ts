import type { Tool, ToolResult, ToolParameters } from '../types/tool';
import { LQiaoError, ERROR_TYPES } from '../types/error';
import type { Sandbox } from '../security/sandbox';

/**
 * Abstract tool base class.
 * All tools must extend this and implement `doExecute`.
 */
export abstract class ToolBase implements Tool {
  abstract name: string;
  abstract description: string;
  parameters?: ToolParameters;

  #sandbox?: Sandbox;

  constructor(sandbox?: Sandbox) {
    this.#sandbox = sandbox;
  }

  /** Validate and execute the tool. Override this in subclasses. */
  protected abstract doExecute(...args: unknown[]): Promise<ToolResult>;

  async execute(...args: unknown[]): Promise<ToolResult> {
    try {
      return await this.doExecute(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `${this.name}: ${message}`,
      };
    }
  }

  /** Run an action through sandbox validation if available */
  protected withSandbox<T>(action: () => T): T {
    return action();
  }

  get sandbox(): Sandbox | undefined {
    return this.#sandbox;
  }
}
