import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gitStatusTool, gitDiffTool, gitLogTool } from '../git-tools.js';

vi.mock('execa');

const mockExeca = vi.mocked(await import('execa'));

describe('git tools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env['GIT_TERMINAL_PROMPT'] = '0';
  });

  describe('gitStatusTool', () => {
    it('should return git status successfully', async () => {
      mockExeca.execa.mockResolvedValue({
        stdout: '## main...origin/main\n M file1.ts\n?? file2.ts',
      } as never);

      const result = await gitStatusTool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toContain('main');
      expect(result.output).toContain('file1.ts');
    });

    it('should return error when git repo does not exist', async () => {
      mockExeca.execa.mockRejectedValue(new Error('fatal: not a git repository') as never);

      const result = await gitStatusTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('fatal: not a git repository');
    });

    it('should return error when git command fails', async () => {
      mockExeca.execa.mockRejectedValue(new Error('git: command not found') as never);

      const result = await gitStatusTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('git: command not found');
    });

    it('should respect cwd parameter', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '## feature\n M src/app.ts' } as never);

      await gitStatusTool.execute({}, '/custom/path');

      expect(mockExeca.execa).toHaveBeenCalledWith(
        'git',
        ['status', '--short', '--branch'],
        { cwd: '/custom/path' },
      );
    });
  });

  describe('gitDiffTool', () => {
    it('should return unstaged diff by default', async () => {
      mockExeca.execa.mockResolvedValue({
        stdout: '-old line\n+new line\n@@ -1,3 +1,3 @@',
      } as never);

      const result = await gitDiffTool.execute({});

      expect(mockExeca.execa).toHaveBeenCalledWith('git', ['diff', 'HEAD'], expect.any(Object));
      expect(result.success).toBe(true);
    });

    it('should return staged diff when staged=true', async () => {
      mockExeca.execa.mockResolvedValue({
        stdout: '+added line\n@@ -1,2 +1,3 @@',
      } as never);

      const result = await gitDiffTool.execute({ staged: true });

      expect(mockExeca.execa).toHaveBeenCalledWith(
        'git',
        ['diff', '--staged'],
        expect.any(Object),
      );
      expect(result.success).toBe(true);
    });

    it('should return "(no changes)" for empty diff', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '' } as never);

      const result = await gitDiffTool.execute({});

      expect(result.success).toBe(true);
      expect(result.output).toBe('(no changes)');
    });

    it('should return error when git repo does not exist', async () => {
      mockExeca.execa.mockRejectedValue(new Error('fatal: not a git repository') as never);

      const result = await gitDiffTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('fatal: not a git repository');
    });

    it('should respect cwd parameter', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '' } as never);

      await gitDiffTool.execute({ cwd: '/my/repo' });

      expect(mockExeca.execa).toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        { cwd: '/my/repo' },
      );
    });
  });

  describe('gitLogTool', () => {
    it('should return recent commits with default limit', async () => {
      mockExeca.execa.mockResolvedValue({
        stdout: 'abc1234 feat: add new feature\ndef5678 fix: resolve bug',
      } as never);

      const result = await gitLogTool.execute({});

      expect(mockExeca.execa).toHaveBeenCalledWith(
        'git',
        ['log', '--max-count=10', '--oneline'],
        expect.any(Object),
      );
      expect(result.success).toBe(true);
    });

    it('should respect custom limit parameter', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: 'commit1 msg\ncommit2 msg' } as never);

      await gitLogTool.execute({ limit: 5 });

      expect(mockExeca.execa).toHaveBeenCalledWith(
        'git',
        ['log', '--max-count=5', '--oneline'],
        expect.any(Object),
      );
    });

    it('should return error when git repo does not exist', async () => {
      mockExeca.execa.mockRejectedValue(new Error('fatal: not a git repository') as never);

      const result = await gitLogTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('fatal: not a git repository');
    });

    it('should return error when git log command fails', async () => {
      mockExeca.execa.mockRejectedValue(new Error('git: fatal: your version is old') as never);

      const result = await gitLogTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('git: fatal: your version is old');
    });

    it('should respect cwd parameter', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '' } as never);

      await gitLogTool.execute({}, '/project/path');

      expect(mockExeca.execa).toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        { cwd: '/project/path' },
      );
    });
  });
});
