import { describe, it, expect } from 'vitest';
import { Sandbox } from '../../../src/security/sandbox';
import { LQiaoError, ERROR_TYPES } from '../../../src/types/error';
import { resolve } from 'node:path';

describe('Sandbox', () => {
  describe('validatePath', () => {
    it('should allow paths within allowed directory', () => {
      const sandbox = new Sandbox({ allowedPaths: [process.cwd()] });
      const result = sandbox.validatePath('package.json');
      expect(result).toBe(resolve('package.json'));
    });

    it('should block paths outside allowed directory', () => {
      const sandbox = new Sandbox({ allowedPaths: ['/tmp/allowed'] });
      expect(() => sandbox.validatePath('/etc/passwd')).toThrow(LQiaoError);
    });

    it('should block paths matching blacklist', () => {
      const sandbox = new Sandbox({
        allowedPaths: [process.cwd()],
        blockedPaths: ['/tmp/secret'],
      });
      expect(() => sandbox.validatePath('/tmp/secret/file.txt')).toThrow(LQiaoError);
    });

    it('should throw SANDBOX_VIOLATION error type', () => {
      const sandbox = new Sandbox({ allowedPaths: ['/tmp/allowed'] });
      try {
        sandbox.validatePath('/etc/passwd');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(LQiaoError);
        expect((e as LQiaoError).type).toBe(ERROR_TYPES.SANDBOX_VIOLATION);
      }
    });
  });

  describe('executeCode', () => {
    it('should execute simple expressions', async () => {
      const sandbox = new Sandbox();
      const result = await sandbox.executeCode('return 1 + 2;');
      expect(result).toBe(3);
    });

    it('should block require', async () => {
      const sandbox = new Sandbox();
      await expect(sandbox.executeCode('return require("fs");')).rejects.toThrow();
    });

    it('should block process access', async () => {
      const sandbox = new Sandbox();
      const result = await sandbox.executeCode('return process;');
      expect(result).toBeUndefined();
    });

    it('should support basic arithmetic', async () => {
      const sandbox = new Sandbox();
      const result = await sandbox.executeCode('return Math.pow(2, 10);');
      expect(result).toBe(1024);
    });
  });

  describe('isCommandBlocked', () => {
    const sandbox = new Sandbox();

    it('should block rm -rf', () => {
      expect(sandbox.isCommandBlocked('rm -rf /')).toBe(true);
    });

    it('should not block safe commands', () => {
      expect(sandbox.isCommandBlocked('ls -la')).toBe(false);
    });

    it('should block variations with arguments', () => {
      expect(sandbox.isCommandBlocked('rm -rf /some/path')).toBe(true);
    });
  });
});
