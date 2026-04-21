import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileTool } from '../../../src/tools/file-tool';
import { Sandbox } from '../../../src/security/sandbox';
import { LQiaoError, ERROR_TYPES } from '../../../src/types/error';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const TEST_DIR = join(process.cwd(), 'tests', 'fixtures', 'sandbox-test');

describe('FileTool', () => {
  let tool: FileTool;
  let sandbox: Sandbox;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    sandbox = new Sandbox({ allowedPaths: [TEST_DIR] });
    tool = new FileTool(sandbox);
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should write and read files', async () => {
    const writeResult = await tool.execute('write', join(TEST_DIR, 'test.txt'), 'hello world');
    expect(writeResult.success).toBe(true);

    const readResult = await tool.execute('read', join(TEST_DIR, 'test.txt'));
    expect(readResult.success).toBe(true);
    expect(readResult.data).toBe('hello world');
  });

  it('should delete files', async () => {
    await tool.execute('write', join(TEST_DIR, 'delete-me.txt'), 'delete me');
    const deleteResult = await tool.execute('delete', join(TEST_DIR, 'delete-me.txt'));
    expect(deleteResult.success).toBe(true);

    const readResult = await tool.execute('read', join(TEST_DIR, 'delete-me.txt'));
    expect(readResult.success).toBe(false);
  });

  it('should block access outside sandbox', async () => {
    const result = await tool.execute('read', '/etc/passwd');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path outside allowed');
  });

  it('should return error for unknown action', async () => {
    const result = await tool.execute('chmod', join(TEST_DIR, 'test.txt'));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown file action');
  });

  it('should return error for write without content', async () => {
    const result = await tool.execute('write', join(TEST_DIR, 'empty.txt'));
    expect(result.success).toBe(false);
    expect(result.error).toContain('requires content');
  });
});
