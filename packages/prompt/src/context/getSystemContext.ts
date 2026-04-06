/**
 * Builds system context appended to the system prompt.
 * Includes git state and cache-breaker hash.
 */
import type { SystemContext } from '../types.js'

export function getSystemContext({
  gitBranch,
  gitStatus,
  promptHash,
}: {
  gitBranch?: string
  gitStatus?: string
  promptHash?: string
}): SystemContext {
  const ctx: SystemContext = {}

  if (gitBranch) {
    ctx.git_branch = gitBranch
  }

  if (gitStatus) {
    ctx.git_status = gitStatus
  }

  // Cache breaker - changes when prompt content changes significantly
  if (promptHash) {
    ctx.cache_breaker = promptHash
  }

  return ctx
}
