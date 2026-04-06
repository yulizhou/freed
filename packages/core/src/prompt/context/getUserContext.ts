/**
 * Builds user context injected as a meta user message.
 * Includes project identity and session-start date.
 */
import type { UserContext } from '../types.js'

export async function getUserContext({
  projectName,
  sessionStartDate,
}: {
  projectName?: string
  sessionStartDate: Date
}): Promise<UserContext> {
  const dateStr = sessionStartDate.toISOString().split('T')[0]

  const ctx: UserContext = {
    date: dateStr ?? sessionStartDate.toISOString().substring(0, 10),
  }

  if (projectName) {
    ctx.project = projectName
  }

  return ctx
}
