import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectEnvContext } from '../env-context.js';

vi.mock('execa');
vi.mock('node:os');

const mockExeca = vi.mocked(await import('execa'));
const mockOs = vi.mocked(await import('node:os'));

describe('collectEnvContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default OS mocks
    mockOs.default.type = vi.fn(() => 'Darwin');
    mockOs.default.release = vi.fn(() => '23.5.0');
    mockOs.default.arch = vi.fn(() => 'arm64');
    // Default SHELL env
    process.env['SHELL'] = '/bin/zsh';
    delete process.env['BUN_VERSION'];
  });

  it('should return OS info with platform details', async () => {
    mockExeca.execa.mockResolvedValue({ stdout: '' } as never);
    const result = await collectEnvContext();
    expect(result.os).toBe('Darwin 23.5.0 (arm64)');
    expect(result.shell).toBe('/bin/zsh');
  });

  it('should return node version', async () => {
    mockExeca.execa.mockResolvedValue({ stdout: '' } as never);
    const result = await collectEnvContext();
    expect(result.nodeVersion).toBe(process.version);
  });

  describe('git context', () => {
    it('should collect git branch and status when in a git repo', async () => {
      mockExeca.execa
        .mockResolvedValueOnce({ stdout: 'main' } as never) // rev-parse --abbrev-ref HEAD
        .mockResolvedValueOnce({ stdout: ' M file1.ts\n?? file2.ts' } as never); // status --short

      const result = await collectEnvContext('/some/path');

      // Check rev-parse call
      expect(mockExeca.execa).toHaveBeenNthCalledWith(1, 'git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: '/some/path',
      });
      // Check status call
      expect(mockExeca.execa).toHaveBeenNthCalledWith(2, 'git', ['status', '--short'], {
        cwd: '/some/path',
      });

      expect(result.gitBranch).toBe('main');
      // gitStatus is .trim()ed so leading space is removed
      expect(result.gitStatus).toBe('M file1.ts\n?? file2.ts');
    });

    it('should parse changed files from git status output', async () => {
      mockExeca.execa
        .mockResolvedValueOnce({ stdout: 'feature-branch' } as never)
        .mockResolvedValueOnce({ stdout: 'M  packages/tools/src/file.ts\n A packages/tools/src/new.ts\n?? untracked.txt' } as never);

      const result = await collectEnvContext();

      expect(result.gitChangedFiles).toEqual([
        'packages/tools/src/file.ts',
        'packages/tools/src/new.ts',
        'untracked.txt',
      ]);
    });

    it('should handle empty git status', async () => {
      mockExeca.execa
        .mockResolvedValueOnce({ stdout: 'main' } as never)
        .mockResolvedValueOnce({ stdout: '' } as never);

      const result = await collectEnvContext();

      expect(result.gitBranch).toBe('main');
      expect(result.gitStatus).toBe('');
      expect(result.gitChangedFiles).toEqual([]);
    });

    it('should gracefully handle when git is not available', async () => {
      mockExeca.execa.mockRejectedValue(new Error('git not found') as never);

      const result = await collectEnvContext();

      expect(result.gitBranch).toBeUndefined();
      expect(result.gitStatus).toBeUndefined();
      expect(result.gitChangedFiles).toBeUndefined();
    });

    it('should handle cwd override parameter', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: 'develop' } as never);

      await collectEnvContext('/custom/cwd');

      expect(mockExeca.execa).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: '/custom/cwd' },
      );
    });
  });

  describe('bun version detection', () => {
    it('should detect bun version from globalThis.BUN', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '' } as never);
      const bunVersion = '1.2.3';
      (globalThis as { BUN?: { version: string } })['BUN'] = { version: bunVersion };

      const result = await collectEnvContext();

      expect(result.bunVersion).toBe(bunVersion);
      delete (globalThis as { BUN?: { version: string } })['BUN'];
    });

    it('should detect bun version from BUN_VERSION env var', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '' } as never);
      process.env['BUN_VERSION'] = '1.0.0';

      const result = await collectEnvContext();

      expect(result.bunVersion).toBe('1.0.0');
      delete process.env['BUN_VERSION'];
    });

    it('should return undefined when bun is not available', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '' } as never);
      delete (globalThis as { BUN?: { version: string } })['BUN'];
      delete process.env['BUN_VERSION'];

      const result = await collectEnvContext();

      expect(result.bunVersion).toBeUndefined();
    });
  });

  describe('cwd handling', () => {
    it('should use provided cwd when given', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '' } as never);

      const result = await collectEnvContext('/my/project');

      expect(result.cwd).toBe('/my/project');
    });

    it('should fall back to process.cwd when no cwd provided', async () => {
      mockExeca.execa.mockResolvedValue({ stdout: '' } as never);

      const result = await collectEnvContext();

      expect(result.cwd).toBe(process.cwd());
    });
  });
});
