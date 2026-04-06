import { execa } from 'execa';
import type { AnyToolDefinition } from './types.js';

export const gitStatusTool: AnyToolDefinition = {
  name: 'git_status',
  description: 'Get the current git status of the repository.',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      cwd: { type: 'string' },
    },
    required: [],
  },
  async execute(input, cwdOverride) {
    const { cwd } = input as { cwd?: string };
    const workingDir = cwd ?? cwdOverride ?? process.cwd();
    try {
      const { stdout } = await execa('git', ['status', '--short', '--branch'], { cwd: workingDir });
      return { success: true, output: stdout };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return { success: false, output: '', error: e.message ?? String(err) };
    }
  },
};

export const gitDiffTool: AnyToolDefinition = {
  name: 'git_diff',
  description: 'Show the current git diff (staged and unstaged changes).',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      staged: { type: 'boolean', description: 'If true, show only staged diff.' },
      cwd: { type: 'string' },
    },
    required: [],
  },
  async execute(input, cwdOverride) {
    const { staged, cwd } = input as { staged?: boolean; cwd?: string };
    const workingDir = cwd ?? cwdOverride ?? process.cwd();
    const args = staged ? ['diff', '--staged'] : ['diff', 'HEAD'];
    try {
      const { stdout } = await execa('git', args, { cwd: workingDir });
      return { success: true, output: stdout || '(no changes)' };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return { success: false, output: '', error: e.message ?? String(err) };
    }
  },
};

export const gitLogTool: AnyToolDefinition = {
  name: 'git_log',
  description: 'Show recent git commits.',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Number of commits to show (default: 10).' },
      cwd: { type: 'string' },
    },
    required: [],
  },
  async execute(input, cwdOverride) {
    const { limit = 10, cwd } = input as { limit?: number; cwd?: string };
    const workingDir = cwd ?? cwdOverride ?? process.cwd();
    try {
      const { stdout } = await execa('git', ['log', `--max-count=${limit}`, '--oneline'], {
        cwd: workingDir,
      });
      return { success: true, output: stdout };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return { success: false, output: '', error: e.message ?? String(err) };
    }
  },
};
