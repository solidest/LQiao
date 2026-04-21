import { promises as fs } from 'node:fs';
import { ToolBase } from './base';
import type { ToolResult } from '../types/tool';
import type { Sandbox } from '../security/sandbox';

/** Normalized args from various call conventions */
interface FileArgs {
  action: string;
  path: string;
  content?: string;
}

/**
 * Built-in file tool: read, write, delete files within sandbox boundaries.
 */
export class FileTool extends ToolBase {
  name = 'file';
  description = 'File operations: read, write, delete';

  constructor(sandbox?: Sandbox) {
    super(sandbox);
  }

  protected async doExecute(...args: unknown[]): Promise<ToolResult> {
    const { action, path, content } = extractArgs(args);
    const safePath = this.sandbox ? this.sandbox.validatePath(path) : path;

    switch (action.toLowerCase()) {
      case 'read':
        try {
          const data = await fs.readFile(safePath, 'utf-8');
          return { success: true, data };
        } catch (e) {
          return { success: false, error: `Failed to read file: ${e}` };
        }

      case 'write':
        if (content === undefined) {
          return { success: false, error: 'Write requires content' };
        }
        try {
          await fs.writeFile(safePath, content, 'utf-8');
          return { success: true, data: { path: safePath, bytes: Buffer.byteLength(content) } };
        } catch (e) {
          return { success: false, error: `Failed to write file: ${e}` };
        }

      case 'delete':
        try {
          await fs.unlink(safePath);
          return { success: true, data: { path: safePath } };
        } catch (e) {
          return { success: false, error: `Failed to delete file: ${e}` };
        }

      default:
        return { success: false, error: `Unknown file action: ${action}. Use read/write/delete.` };
    }
  }
}

/** Extract action/path/content from args (supports object or positional args) */
function extractArgs(args: unknown[]): FileArgs {
  if (args.length === 0) {
    return { action: '', path: '' };
  }

  const first = args[0];
  if (typeof first === 'object' && first !== null) {
    const obj = first as Record<string, unknown>;
    if ('action' in obj && typeof obj.action === 'string') {
      return {
        action: obj.action,
        path: (obj.path as string) ?? '',
        content: obj.content as string | undefined,
      };
    }
    // Numeric-key format from LLM: { "0": "read", "1": "/path" }
    return {
      action: (obj['0'] as string) ?? '',
      path: (obj['1'] as string) ?? '',
      content: obj['2'] as string | undefined,
    };
  }

  // Positional: doExecute('read', '/path', content)
  return {
    action: args[0] as string,
    path: (args[1] as string) ?? '',
    content: args[2] as string | undefined,
  };
}
