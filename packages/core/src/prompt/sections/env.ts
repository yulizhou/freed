/**
 * Environment information section.
 * Formats EnvContext into a readable block.
 */
import type { EnvContext } from '../../shared/index.js'

export function getEnvInfoSection(env: EnvContext): string {
  const lines = [
    `## Environment`,
    `OS: ${env.os}`,
    `Shell: ${env.shell}`,
    `CWD: ${env.cwd}`,
    `Node: ${env.nodeVersion}`,
  ]

  if (env.bunVersion) {
    lines.push(`Bun: ${env.bunVersion}`)
  }

  if (env.gitBranch) {
    lines.push(`Git branch: ${env.gitBranch}`)
  }

  if (env.gitStatus) {
    lines.push(`Git status: ${env.gitStatus}`)
  }

  if (env.gitChangedFiles && env.gitChangedFiles.length > 0) {
    lines.push(`Changed files: ${env.gitChangedFiles.join(', ')}`)
  }

  return lines.join('\n')
}
