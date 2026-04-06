import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  wrapInSystemReminder,
  wrapMessagesInSystemReminder,
} from '../attachments/createSystemReminder.js'
import {
  buildSkillDiscoveryAttachment,
  buildMcpDeltaAttachment,
  buildAttachmentsForTurn,
} from '../attachments/injectDynamicAttachments.js'

// ─── createSystemReminder tests ─────────────────────────────────────────────────

describe('wrapInSystemReminder', () => {
  it('wraps content in system-reminder tags', () => {
    const result = wrapInSystemReminder('some reminder content')
    expect(result).toContain('<system-reminder>')
    expect(result).toContain('</system-reminder>')
    expect(result).toContain('some reminder content')
  })

  it('preserves exact content without adding extra whitespace', () => {
    const content = 'line1\nline2'
    const result = wrapInSystemReminder(content)
    expect(result).toContain('line1')
    expect(result).toContain('line2')
    // should not inject extra newlines in the middle
    expect(result).not.toContain('\n\n\n')
  })
})

describe('wrapMessagesInSystemReminder', () => {
  it('wraps string content in system-reminder tags', () => {
    const messages = [
      {
        message: {
          content: 'remember to check the logs',
        },
      },
    ]
    const result = wrapMessagesInSystemReminder(messages)
    expect(result[0].message.content).toContain('<system-reminder>')
    expect(result[0].message.content).toContain('remember to check the logs')
  })

  it('leaves non-string content unchanged', () => {
    const messages = [
      {
        message: {
          content: { nested: 'object' },
        },
      },
    ]
    const result = wrapMessagesInSystemReminder(messages)
    expect(result[0].message.content).toEqual({ nested: 'object' })
  })

  it('returns a new array with mapped messages', () => {
    const messages = [
      { message: { content: 'msg1' } },
      { message: { content: 'msg2' } },
    ]
    const result = wrapMessagesInSystemReminder(messages)
    expect(result).toHaveLength(2)
    expect(result).not.toBe(messages)
  })
})

// ─── buildSkillDiscoveryAttachment tests ──────────────────────────────────────

describe('buildSkillDiscoveryAttachment', () => {
  it('returns an empty array for empty skills', () => {
    const result = buildSkillDiscoveryAttachment([])
    expect(result).toEqual([])
  })

  it('returns an array with one message for non-empty skills', () => {
    const skills = [{ name: 'my-skill', description: 'Does things' }]
    const result = buildSkillDiscoveryAttachment(skills)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('user')
    expect(result[0].isMeta).toBe(true)
  })

  it('message content includes skill names and descriptions', () => {
    const skills = [
      { name: 'skill-a', description: 'Description A' },
      { name: 'skill-b', description: 'Description B' },
    ]
    const result = buildSkillDiscoveryAttachment(skills)
    expect(result[0].content).toContain('skill-a')
    expect(result[0].content).toContain('Description A')
    expect(result[0].content).toContain('skill-b')
    expect(result[0].content).toContain('Description B')
  })

  it('message id starts with skill-discovery-', () => {
    const result = buildSkillDiscoveryAttachment([{ name: 's', description: 'd' }])
    expect(result[0].id).toMatch(/^skill-discovery-/)
  })
})

// ─── buildMcpDeltaAttachment tests ────────────────────────────────────────────

describe('buildMcpDeltaAttachment', () => {
  it('returns empty array when both added and removed are empty', () => {
    const result = buildMcpDeltaAttachment({})
    expect(result).toEqual([])
  })

  it('returns empty array when added is empty array', () => {
    const result = buildMcpDeltaAttachment({ added: [] })
    expect(result).toEqual([])
  })

  it('returns empty array when removed is empty array', () => {
    const result = buildMcpDeltaAttachment({ removed: [] })
    expect(result).toEqual([])
  })

  it('includes added servers in message', () => {
    const result = buildMcpDeltaAttachment({ added: ['server-a', 'server-b'] })
    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('server-a')
    expect(result[0].content).toContain('server-b')
    expect(result[0].content).toContain('MCP servers connected')
  })

  it('includes removed servers in message', () => {
    const result = buildMcpDeltaAttachment({ removed: ['server-x'] })
    expect(result).toHaveLength(1)
    expect(result[0].content).toContain('server-x')
    expect(result[0].content).toContain('MCP servers disconnected')
  })

  it('returns message with correct metadata', () => {
    const result = buildMcpDeltaAttachment({ added: ['svc'] })
    expect(result[0].role).toBe('user')
    expect(result[0].isMeta).toBe(true)
    expect(result[0].id).toMatch(/^mcp-delta-/)
  })
})

// ─── buildAttachmentsForTurn tests ────────────────────────────────────────────

describe('buildAttachmentsForTurn', () => {
  it('returns empty array for empty attachments', () => {
    const result = buildAttachmentsForTurn([])
    expect(result).toEqual([])
  })

  it('handles skill_discovery attachment type', () => {
    const attachments = [{ type: 'skill_discovery' as const, skills: [{ name: 's', description: 'd' }] }]
    const result = buildAttachmentsForTurn(attachments)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].role).toBe('user')
  })

  it('handles mcp_delta attachment type with added servers', () => {
    const attachments = [{ type: 'mcp_delta' as const, added: ['srv1'] }]
    const result = buildAttachmentsForTurn(attachments)
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles mcp_delta attachment type with removed servers', () => {
    const attachments = [{ type: 'mcp_delta' as const, removed: ['srv1'] }]
    const result = buildAttachmentsForTurn(attachments)
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles relevant_memories attachment type', () => {
    const attachments = [{
      type: 'relevant_memories' as const,
      memories: [{ scope: 'project', content: 'Memory content' }],
    }]
    const result = buildAttachmentsForTurn(attachments)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].content).toContain('Memory content')
  })

  it('skips relevant_memories with empty memories array', () => {
    const attachments = [{ type: 'relevant_memories' as const, memories: [] }]
    const result = buildAttachmentsForTurn(attachments)
    expect(result).toEqual([])
  })

  it('combines multiple attachments into a single message array', () => {
    const attachments = [
      { type: 'skill_discovery' as const, skills: [{ name: 's', description: 'd' }] },
      { type: 'mcp_delta' as const, added: ['srv'] },
    ]
    const result = buildAttachmentsForTurn(attachments)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('each result message has correct metadata', () => {
    const attachments = [{ type: 'skill_discovery' as const, skills: [{ name: 's', description: 'd' }] }]
    const result = buildAttachmentsForTurn(attachments)
    expect(result[0].role).toBe('user')
    expect(result[0].isMeta).toBe(true)
    expect(result[0].id).toBeTruthy()
  })
})
