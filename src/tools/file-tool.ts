import { promises as fs } from 'node:fs';
import { ToolBase } from './base';
import type { ToolResult } from '../types/tool';
import type { Sandbox } from '../security/sandbox';

/**
 * Built-in file tool: read, write, delete files within sandbox boundaries.
 */
export class FileTool extends ToolBase {
  name = 'file';
  description = 'File operations: read, write, delete';

  constructor(sandbox?: Sandbox) {
    super(sandbox);
  }

  protected async doExecute(action: string, path: string, content?: string): Promise<ToolResult> {
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
