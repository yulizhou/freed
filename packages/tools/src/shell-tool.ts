import { execa } from 'execa';
import type { AnyToolDefinition } from './types.js';

// Patterns that indicate a high-risk shell command
const HIGH_RISK_PATTERNS = [
  /rm\s+-rf?\s/,
  /git\s+reset\s+--hard/,
  /git\s+checkout\s+--\s/,
  /git\s+push\s+.*--force/,
  /:\s*>\s*\//,   // redirect to root
  /dd\s+if=/,
  /mkfs\./,
  /chmod\s+777/,
  /sudo\s+/,
];

export function classifyShellRisk(command: string): 'safe' | 'ask' | 'deny' {
  if (HIGH_RISK_PATTERNS.some((re) => re.test(command))) {
    return 'ask';
  }
  return 'safe';
}

export const shellTool: AnyToolDefinition = {
  name: 'shell',
  description: 'Execute a shell command and return its stdout/stderr.',
  riskLevel: 'ask', // always ask for shell – executor may downgrade to safe based on command analysis
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute.' },
      cwd: { type: 'string', description: 'Working directory (optional, defaults to process.cwd()).' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000).' },
    },
    required: ['command'],
  },
  async execute(input, cwdOverride) {
    const { command, cwd, timeout = 30_000 } = input as {
      command: string;
      cwd?: string;
      timeout?: number;
    };

    const workingDir = cwd ?? cwdOverride ?? process.cwd();

    try {
      const result = await execa('sh', ['-c', command], {
        cwd: workingDir,
        timeout,
        all: true,
      });
      const output = result.all ?? result.stdout;
      return { success: true, output: output ?? '' };
    } catch (err: unknown) {
      const execaErr = err as { all?: string; shortMessage?: string; message?: string };
      const output = execaErr.all ?? '';
      const error = execaErr.shortMessage ?? execaErr.message ?? String(err);
      return { success: false, output, error };
    }
  },
};
