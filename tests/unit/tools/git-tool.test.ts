import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitTool } from '../../../src/tools/git-tool';

const mockGit = {
  add: vi.fn(),
  commit: vi.fn(),
  push: vi.fn(),
};

vi.mock('simple-git', () => ({
  default: () => mockGit,
}));

describe('GitTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('add', () => {
    it('should add files successfully', async () => {
      mockGit.add.mockResolvedValue({});
      const tool = new GitTool();
      const result = await tool.execute('add', 'src/index.ts');

      expect(result.success).toBe(true);
      expect(mockGit.add).toHaveBeenCalledWith(['src/index.ts']);
    });

    it('should fail with empty file list', async () => {
      const tool = new GitTool();
      const result = await tool.execute('add');

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires');
    });

    it('should fail when git add throws', async () => {
      mockGit.add.mockRejectedValue(new Error('not a git repo'));
      const tool = new GitTool();
      const result = await tool.execute('add', 'file.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a git repo');
    });
  });

  describe('commit', () => {
    it('should commit with message', async () => {
      mockGit.commit.mockResolvedValue({});
      const tool = new GitTool();
      const result = await tool.execute('commit', 'fix: bug');

      expect(result.success).toBe(true);
      expect(mockGit.commit).toHaveBeenCalledWith('fix: bug');
    });

    it('should commit with author', async () => {
      mockGit.commit.mockResolvedValue({});
      const tool = new GitTool();
      const result = await tool.execute('commit', 'fix: bug', 'Test User <test@example.com>');

      expect(result.success).toBe(true);
      expect(mockGit.commit).toHaveBeenCalledWith(
        ['-m', 'fix: bug'],
        { '--author': 'Test User <test@example.com>' },
      );
    });

    it('should fail with empty message', async () => {
      const tool = new GitTool();
      const result = await tool.execute('commit', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires a message');
    });

    it('should fail when git commit throws', async () => {
      mockGit.commit.mockRejectedValue(new Error('nothing to commit'));
      const tool = new GitTool();
      const result = await tool.execute('commit', 'msg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('nothing to commit');
    });
  });

  describe('push', () => {
    it('should push to origin', async () => {
      mockGit.push.mockResolvedValue({});
      const tool = new GitTool();
      const result = await tool.execute('push');

      expect(result.success).toBe(true);
      expect(mockGit.push).toHaveBeenCalledWith('origin', undefined);
    });

    it('should push to custom remote and branch', async () => {
      mockGit.push.mockResolvedValue({});
      const tool = new GitTool();
      const result = await tool.execute('push', 'upstream', 'main');

      expect(result.success).toBe(true);
      expect(mockGit.push).toHaveBeenCalledWith('upstream', 'main');
    });

    it('should fail when git push throws', async () => {
      mockGit.push.mockRejectedValue(new Error('remote rejected'));
      const tool = new GitTool();
      const result = await tool.execute('push');

      expect(result.success).toBe(false);
      expect(result.error).toContain('remote rejected');
    });
  });

  describe('unknown action', () => {
    it('should return error for unknown action', async () => {
      const tool = new GitTool();
      const result = await tool.execute('merge', 'main');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown git action');
    });
  });
});
