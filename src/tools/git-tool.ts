import simpleGit, { type SimpleGit } from 'simple-git';
import { ToolBase } from './base';
import type { ToolResult } from '../types/tool';
import type { Sandbox } from '../security/sandbox';

export interface GitLogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitDiff {
  file: string;
  changes: string;
  stats: { added: number; removed: number };
}

export interface GitStatus {
  staged: string[];
  modified: string[];
  untracked: string[];
}

/**
 * Built-in Git tool: add, commit, push, log, diff, status operations.
 * Uses simple-git for cross-platform compatibility.
 */
export class GitTool extends ToolBase {
  name = 'git';
  description = 'Git operations: add, commit, push, log, diff, status';

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

      case 'log':
        return this.#doLog(rest.count as number | undefined, rest.file as string | undefined);

      case 'diff':
        return this.#doDiff(rest.file as string | undefined, rest.revision as string | undefined);

      case 'status':
        return this.#doStatus();

      default:
        return { success: false, error: `Unknown git action: ${action}. Use add/commit/push/log/diff/status.` };
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

  async #doLog(count = 10, file?: string): Promise<ToolResult> {
    try {
      const options: { n: number; file?: string } = { n: count };
      if (file) options.file = file;
      const log = await this.#git.log(options);
      const entries: GitLogEntry[] = log.all.map((c) => ({
        hash: c.hash,
        author: `${c.author_name} <${c.author_email}>`,
        date: c.date,
        message: c.message,
      }));
      return { success: true, data: { entries, total: entries.length } };
    } catch (e) {
      return { success: false, error: `Git log failed: ${e}` };
    }
  }

  async #doDiff(file?: string, revision?: string): Promise<ToolResult> {
    try {
      const args: string[] = [];
      if (revision) args.push(revision);
      if (file) args.push('--', file);

      const diffText = await this.#git.diff(args);
      const lines = diffText.split('\n');
      const added = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
      const removed = lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length;

      const target = file ?? revision ?? 'working tree';
      const result: GitDiff = { file: target, changes: diffText, stats: { added, removed } };
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: `Git diff failed: ${e}` };
    }
  }

  async #doStatus(): Promise<ToolResult> {
    try {
      const status = await this.#git.status();
      const result: GitStatus = {
        staged: [
          ...status.created,
          ...status.staged,
          ...status.renamed.map((r) => (typeof r === 'string' ? r : r.to)),
        ],
        modified: [...status.modified, ...status.deleted],
        untracked: [...status.not_added],
      };
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: `Git status failed: ${e}` };
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
    case 'log':
      return { action, count: args[1] ?? 10, file: args[2] };
    case 'diff':
      return { action, file: args[1], revision: args[2] };
    case 'status':
      return { action };
    default:
      return { action, extra: args.slice(1) };
  }
}
