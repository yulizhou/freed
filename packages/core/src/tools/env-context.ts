import os from 'node:os';
import { execa } from 'execa';
import type { EnvContext } from '../shared/index.js';

export async function collectEnvContext(cwd?: string): Promise<EnvContext> {
  const workingDir = cwd ?? process.cwd();

  const osType = `${os.type()} ${os.release()} (${os.arch()})`;
  const shell = process.env['SHELL'] ?? 'unknown';
  const nodeVersion = process.version;
  // Detect Bun runtime
  const bunVersion = (globalThis as { BUN?: { version: string } })['BUN']?.version
    ?? process.env['BUN_VERSION']
    ?? undefined;

  let gitBranch: string | undefined;
  let gitStatus: string | undefined;
  let gitChangedFiles: string[] | undefined;

  try {
    const branchResult = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workingDir,
    });
    gitBranch = branchResult.stdout.trim();

    const statusResult = await execa('git', ['status', '--short'], { cwd: workingDir });
    gitStatus = statusResult.stdout.trim();

    gitChangedFiles = gitStatus
      ? gitStatus
          .split('\n')
          .map((l) => l.trim().split(/\s+/).slice(1).join(' '))
          .filter(Boolean)
      : [];
  } catch {
    // Not a git repo or git not available
  }

  return {
    os: osType,
    shell,
    cwd: workingDir,
    nodeVersion,
    bunVersion,
    gitBranch,
    gitStatus,
    gitChangedFiles,
  };
}
