import simpleGit, { type SimpleGit } from 'simple-git';
import { ToolBase } from './base';
import type { ToolResult } from '../types/tool';
import type { Sandbox } from '../security/sandbox';

/**
 * Built-in Git tool: add, commit, push operations.
 * Uses simple-git for cross-platform compatibility.
 */
export class GitTool extends ToolBase {
  name = 'git';
  description = 'Git operations: add, commit, push';

  #git: SimpleGit;

  constructor(sandbox?: Sandbox, cwd?: string) {
    super(sandbox);
    this.#git = simpleGit(cwd);
  }

  protected async doExecute(action: string, ...args: unknown[]): Promise<ToolResult> {
    const act = action.toLowerCase();

    switch (act) {
      case 'add':
        return this.#doAdd(args as string[]);

      case 'commit':
        return this.#doCommit(args[0] as string, args[1] as string | undefined);

      case 'push':
        return this.#doPush(args[0] as string | undefined, args[1] as string | undefined);

      default:
        return { success: false, error: `Unknown git action: ${action}. Use add/commit/push.` };
    }
  }

  async #doAdd(files: string[]): Promise<ToolResult> {
    if (files.length === 0) {
      return { success: false, error: 'Git add requires at least one file path' };
    }
    try {
      await this.#git.add(files);
      return { success: true, data: { added: files } };
    } catch (e) {
      return { success: false, error: `Git add failed: ${e}` };
    }
  }

  async #doCommit(message: string, author?: string): Promise<ToolResult> {
    if (!message) {
      return { success: false, error: 'Git commit requires a message' };
    }
    try {
      if (author) {
        await this.#git.commit(['-m', message], { '--author': author });
      } else {
        await this.#git.commit(message);
      }
      return { success: true, data: { message } };
    } catch (e) {
      return { success: false, error: `Git commit failed: ${e}` };
    }
  }

  async #doPush(remote?: string, branch?: string): Promise<ToolResult> {
    try {
      await this.#git.push(remote ?? 'origin', branch);
      return { success: true, data: { remote: remote ?? 'origin', branch } };
    } catch (e) {
      return { success: false, error: `Git push failed: ${e}` };
    }
  }
}
