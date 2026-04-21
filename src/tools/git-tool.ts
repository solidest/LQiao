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

  protected async doExecute(...args: unknown[]): Promise<ToolResult> {
    const { action, ...rest } = extractArgs(args);
    const act = action.toLowerCase();

    switch (act) {
      case 'add':
        return this.#doAdd((rest.paths as string[]) ?? []);

      case 'commit':
        return this.#doCommit(rest.message as string, rest.author as string | undefined);

      case 'push':
        return this.#doPush(rest.remote as string | undefined, rest.branch as string | undefined);

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

/** Extract action and parameters from args (supports object or positional args) */
function extractArgs(args: unknown[]): { action: string } & Record<string, unknown> {
  if (args.length === 0) {
    return { action: '' };
  }

  const first = args[0];
  if (typeof first === 'object' && first !== null) {
    const obj = first as Record<string, unknown>;
    if ('action' in obj && typeof obj.action === 'string') {
      const { action, ...rest } = obj;
      return { action, ...rest };
    }
    // Numeric-key format from LLM
    return {
      action: (obj['0'] as string) ?? '',
      ...Object.fromEntries(Object.entries(obj).filter(([k]) => k !== '0')),
    };
  }

  // Positional: action, arg2, arg3...
  const action = args[0] as string;
  switch (action.toLowerCase()) {
    case 'add':
      return { action, paths: Array.isArray(args[1]) ? args[1] : [args[1]].filter(Boolean) as string[] };
    case 'commit':
      return { action, message: args[1], author: args[2] };
    case 'push':
      return { action, remote: args[1], branch: args[2] };
    default:
      return { action, extra: args.slice(1) };
  }
}
