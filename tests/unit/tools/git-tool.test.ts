import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitTool } from '../../../src/tools/git-tool';

const mockGit = {
  add: vi.fn(),
  commit: vi.fn(),
  push: vi.fn(),
  log: vi.fn(),
  diff: vi.fn(),
  status: vi.fn(),
};

vi.mock('simple-git', () => ({
  default: () => mockGit,
}));

describe('GitTool', () => {
  beforeEach(() => {
    Object.values(mockGit).forEach((fn) => fn.mockReset());
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

  describe('numeric-key args (LLM format)', () => {
    it('should map {0: "log", 1: count} to correct params', async () => {
      mockGit.log.mockResolvedValue({ all: [], latest: null });
      const tool = new GitTool();
      await tool.execute({ 0: 'log', 1: 5 });

      expect(mockGit.log).toHaveBeenCalledWith({ n: 5 });
    });

    it('should map {0: "diff", 1: file} to correct params', async () => {
      mockGit.diff.mockResolvedValue('');
      const tool = new GitTool();
      await tool.execute({ 0: 'diff', 1: 'src/main.ts' });

      expect(mockGit.diff).toHaveBeenCalledWith(['--', 'src/main.ts']);
    });

    it('should map {0: "commit", 1: message, 2: author} to correct params', async () => {
      mockGit.commit.mockResolvedValue({});
      const tool = new GitTool();
      await tool.execute({ 0: 'commit', 1: 'fix bug', 2: 'User <u@e.com>' });

      expect(mockGit.commit).toHaveBeenCalledWith(
        ['-m', 'fix bug'],
        { '--author': 'User <u@e.com>' },
      );
    });
  });

  describe('log', () => {
    it('should return recent commits', async () => {
      mockGit.log.mockResolvedValue({
        all: [
          { hash: 'abc123', author_name: 'Test User', author_email: 'test@example.com', date: '2026-01-01', message: 'feat: add feature' },
          { hash: 'def456', author_name: 'Another', author_email: 'a@example.com', date: '2025-12-31', message: 'fix: bug' },
        ],
        latest: { hash: 'abc123' },
      });

      const tool = new GitTool();
      const result = await tool.execute('log');

      expect(result.success).toBe(true);
      expect(result.data.entries).toHaveLength(2);
      expect(result.data.entries[0].author).toBe('Test User <test@example.com>');
      expect(result.data.total).toBe(2);
    });

    it('should pass custom count', async () => {
      mockGit.log.mockResolvedValue({
        all: [{ hash: 'x', author_name: 'A', author_email: 'a@b.com', date: '2026-01-01', message: 'msg' }],
        latest: null,
      });

      const tool = new GitTool();
      await tool.execute('log', 5);

      expect(mockGit.log).toHaveBeenCalledWith({ n: 5 });
    });

    it('should filter by file', async () => {
      mockGit.log.mockResolvedValue({
        all: [],
        latest: null,
      });

      const tool = new GitTool();
      await tool.execute('log', 3, 'src/main.ts');

      expect(mockGit.log).toHaveBeenCalledWith({ n: 3, file: 'src/main.ts' });
    });

    it('should fail when git log throws', async () => {
      mockGit.log.mockRejectedValue(new Error('not a git repo'));

      const tool = new GitTool();
      const result = await tool.execute('log');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a git repo');
    });
  });

  describe('diff', () => {
    it('should return working tree diff', async () => {
      mockGit.diff.mockResolvedValue('--- a/file.txt\n+++ b/file.txt\n+new line\n-old line\n');

      const tool = new GitTool();
      const result = await tool.execute('diff');

      expect(result.success).toBe(true);
      expect(result.data.file).toBe('working tree');
      expect(result.data.stats.added).toBe(1);
      expect(result.data.stats.removed).toBe(1);
    });

    it('should return file-specific diff', async () => {
      mockGit.diff.mockResolvedValue('diff --git a/src/main.ts\n+console.log("hi")\n');

      const tool = new GitTool();
      const result = await tool.execute('diff', 'src/main.ts');

      expect(result.success).toBe(true);
      expect(result.data.file).toBe('src/main.ts');
      expect(mockGit.diff).toHaveBeenCalledWith(['--', 'src/main.ts']);
    });

    it('should return diff for a specific revision', async () => {
      mockGit.diff.mockResolvedValue('diff --git a/file.txt\n+added\n');

      const tool = new GitTool();
      const result = await tool.execute('diff', undefined, 'HEAD~1');

      expect(result.success).toBe(true);
      expect(result.data.file).toBe('HEAD~1');
      expect(mockGit.diff).toHaveBeenCalledWith(['HEAD~1']);
    });

    it('should fail when git diff throws', async () => {
      mockGit.diff.mockRejectedValue(new Error('bad revision'));

      const tool = new GitTool();
      const result = await tool.execute('diff');

      expect(result.success).toBe(false);
      expect(result.error).toContain('bad revision');
    });
  });

  describe('status', () => {
    it('should return workspace status', async () => {
      mockGit.status.mockResolvedValue({
        created: ['new.ts'],
        staged: ['staged.ts'],
        renamed: [],
        modified: ['changed.ts'],
        deleted: ['removed.ts'],
        not_added: ['untracked.txt'],
      });

      const tool = new GitTool();
      const result = await tool.execute('status');

      expect(result.success).toBe(true);
      expect(result.data.staged).toContain('new.ts');
      expect(result.data.staged).toContain('staged.ts');
      expect(result.data.modified).toContain('changed.ts');
      expect(result.data.modified).toContain('removed.ts');
      expect(result.data.untracked).toContain('untracked.txt');
    });

    it('should fail when git status throws', async () => {
      mockGit.status.mockRejectedValue(new Error('not a git repo'));

      const tool = new GitTool();
      const result = await tool.execute('status');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a git repo');
    });
  });
});
