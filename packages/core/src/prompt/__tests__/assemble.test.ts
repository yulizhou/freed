import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildEffectiveSystemPrompt } from '../assemble/buildEffectiveSystemPrompt.js'
import { getDefaultSystemPrompt } from '../assemble/getDefaultSystemPrompt.js'
import { clearSectionCache } from '../sectionRegistry.js'
import type { AgentProfile, EnvContext, ToolDescriptor, Skill } from '../../shared/index.js'

// ─── Mock implementations ──────────────────────────────────────────────────────

const mockGetMemorySummary = vi.fn<() => Promise<string>>()

// ─── buildEffectiveSystemPrompt tests ─────────────────────────────────────────

describe('buildEffectiveSystemPrompt', () => {
  const defaultPrompt = ['default section 1', 'default section 2']

  it('returns default system prompt when no overrides are set', () => {
    const result = buildEffectiveSystemPrompt({ defaultSystemPrompt: defaultPrompt })
    expect(result).toEqual(defaultPrompt)
  })

  it('customSystemPrompt takes priority over default', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: defaultPrompt,
      customSystemPrompt: 'custom prompt',
    })
    expect(result).toEqual(['custom prompt'])
  })

  it('agent systemPrompt takes priority over custom and default', () => {
    const agent: AgentProfile = {
      id: 'test',
      name: 'Test',
      model: 'test/model',
      systemPrompt: 'agent prompt',
      tools: [],
    }
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: defaultPrompt,
      customSystemPrompt: 'custom',
      mainThreadAgentDefinition: agent,
    })
    expect(result).toEqual(['agent prompt'])
  })

  it('overrideSystemPrompt replaces everything', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: defaultPrompt,
      overrideSystemPrompt: 'full override',
    })
    expect(result).toEqual(['full override'])
  })

  it('overrideSystemPrompt takes highest priority (above agent)', () => {
    const agent: AgentProfile = {
      id: 'test',
      name: 'Test',
      model: 'test/model',
      systemPrompt: 'agent prompt',
      tools: [],
    }
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: defaultPrompt,
      mainThreadAgentDefinition: agent,
      overrideSystemPrompt: 'full override',
    })
    expect(result).toEqual(['full override'])
  })

  it('appendSystemPrompt is appended to base when set', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: defaultPrompt,
      appendSystemPrompt: 'appendix',
    })
    expect(result).toEqual(['default section 1', 'default section 2', 'appendix'])
  })

  it('appendSystemPrompt is NOT appended when override is set', () => {
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: defaultPrompt,
      appendSystemPrompt: 'appendix',
      overrideSystemPrompt: 'override',
    })
    expect(result).toEqual(['override'])
  })

  it('handles agent with empty systemPrompt as if not set', () => {
    const agent: AgentProfile = {
      id: 'test',
      name: 'Test',
      model: 'test/model',
      systemPrompt: '',
      tools: [],
    }
    const result = buildEffectiveSystemPrompt({
      defaultSystemPrompt: defaultPrompt,
      customSystemPrompt: 'custom',
      mainThreadAgentDefinition: agent,
    })
    expect(result).toEqual(['custom'])
  })
})

// ─── getDefaultSystemPrompt tests ─────────────────────────────────────────────

describe('getDefaultSystemPrompt', () => {
  beforeEach(() => {
    clearSectionCache()
    mockGetMemorySummary.mockReset()
  })

  const minimalEnv: EnvContext = {
    os: 'linux',
    shell: '/bin/zsh',
    cwd: '/home/user',
    nodeVersion: '22.0.0',
  }

  it('returns a non-empty string array', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const result = await getDefaultSystemPrompt({
      tools: [],
      env: minimalEnv,
      skills: [],
      getMemorySummary: mockGetMemorySummary,
    })
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes static base sections', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const result = await getDefaultSystemPrompt({
      tools: [],
      env: minimalEnv,
      skills: [],
      getMemorySummary: mockGetMemorySummary,
    })
    const joined = result.join(' ')
    expect(joined).toContain('Freed')
    expect(joined).toContain('Capabilities')
  })

  it('includes dynamic boundary marker', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const result = await getDefaultSystemPrompt({
      tools: [],
      env: minimalEnv,
      skills: [],
      getMemorySummary: mockGetMemorySummary,
    })
    expect(result).toContain('__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__')
  })

  it('includes tools section when tools are provided', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const tools: ToolDescriptor[] = [
      { name: 'Read', riskLevel: 'safe', description: 'Read files' } as ToolDescriptor,
    ]
    const result = await getDefaultSystemPrompt({
      tools,
      env: minimalEnv,
      skills: [],
      getMemorySummary: mockGetMemorySummary,
    })
    const joined = result.join(' ')
    expect(joined).toContain('Available Tools')
    expect(joined).toContain('Read')
  })

  it('includes memory section when summary is non-empty', async () => {
    mockGetMemorySummary.mockResolvedValue('user memory content')
    const result = await getDefaultSystemPrompt({
      tools: [],
      env: minimalEnv,
      skills: [],
      getMemorySummary: mockGetMemorySummary,
    })
    const joined = result.join(' ')
    expect(joined).toContain('Memory Context')
    expect(joined).toContain('user memory content')
  })

  it('omits memory section when summary is empty', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const result = await getDefaultSystemPrompt({
      tools: [],
      env: minimalEnv,
      skills: [],
      getMemorySummary: mockGetMemorySummary,
    })
    const joined = result.join(' ')
    expect(joined).not.toContain('Memory Context')
  })

  it('includes language section with custom language', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const result = await getDefaultSystemPrompt({
      tools: [],
      env: minimalEnv,
      skills: [],
      getMemorySummary: mockGetMemorySummary,
      settingsLanguage: 'Japanese',
    })
    const joined = result.join(' ')
    expect(joined).toContain('Japanese')
  })

  it('includes skills section when skills are provided', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const skills: Skill[] = [
      { name: 'my-skill', description: 'A skill' } as Skill,
    ]
    const result = await getDefaultSystemPrompt({
      tools: [],
      env: minimalEnv,
      skills,
      getMemorySummary: mockGetMemorySummary,
    })
    const joined = result.join(' ')
    expect(joined).toContain('Available Skills')
    expect(joined).toContain('my-skill')
  })

  it('omits skills section when skills array is empty', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const result = await getDefaultSystemPrompt({
      tools: [],
      env: minimalEnv,
      skills: [],
      getMemorySummary: mockGetMemorySummary,
    })
    const joined = result.join(' ')
    expect(joined).not.toContain('Available Skills')
  })
})
