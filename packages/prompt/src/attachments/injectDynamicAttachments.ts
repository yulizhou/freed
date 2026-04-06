/**
 * Builds dynamic per-turn attachments as system-reminder messages.
 * These carry information that changes every turn and shouldn't be in the system prompt.
 */
import type { PromptAttachment } from '../types.js'
import { wrapInSystemReminder } from './createSystemReminder.js'
import type { Message } from '@freed/shared'

export function buildSkillDiscoveryAttachment(
  skills: { name: string; description: string }[],
): Message[] {
  if (skills.length === 0) return []

  const lines = skills.map((s) => `- ${s.name}: ${s.description}`)
  const content =
    `Skills relevant to your current task:\n\n${lines.join('\n')}\n\n` +
    `Invoke via the skill command to load full instructions.`

  return [
    {
      id: `skill-discovery-${Date.now()}`,
      role: 'user' as const,
      content: wrapInSystemReminder(content),
      createdAt: new Date(),
      isMeta: true,
    },
  ]
}

export function buildMcpDeltaAttachment(delta: {
  added?: string[]
  removed?: string[]
}): Message[] {
  const parts: string[] = []

  if (delta.added && delta.added.length > 0) {
    parts.push(`MCP servers connected: ${delta.added.join(', ')}`)
  }

  if (delta.removed && delta.removed.length > 0) {
    parts.push(`MCP servers disconnected: ${delta.removed.join(', ')}`)
  }

  if (parts.length === 0) return []

  return [
    {
      id: `mcp-delta-${Date.now()}`,
      role: 'user' as const,
      content: wrapInSystemReminder(parts.join('\n')),
      createdAt: new Date(),
      isMeta: true,
    },
  ]
}

export function buildAttachmentsForTurn(
  attachments: PromptAttachment[],
): Message[] {
  const messages: Message[] = []

  for (const attachment of attachments) {
    if (attachment.type === 'skill_discovery') {
      messages.push(...buildSkillDiscoveryAttachment(attachment.skills))
    } else if (attachment.type === 'mcp_delta') {
      const deltaArg: { added?: string[]; removed?: string[] } = {}
      if (attachment.added !== undefined) deltaArg.added = attachment.added
      if (attachment.removed !== undefined) deltaArg.removed = attachment.removed
      if (attachment.added || attachment.removed) {
        messages.push(...buildMcpDeltaAttachment(deltaArg))
      }
    } else if (attachment.type === 'relevant_memories') {
      if (attachment.memories.length === 0) continue
      const lines = attachment.memories.map(
        (m) => `[${m.scope}] ${m.content}`,
      )
      messages.push({
        id: `relevant-memories-${Date.now()}`,
        role: 'user' as const,
        content: wrapInSystemReminder(
          `Relevant memories:\n\n${lines.join('\n')}`,
        ),
        createdAt: new Date(),
        isMeta: true,
      })
    }
  }

  return messages
}
