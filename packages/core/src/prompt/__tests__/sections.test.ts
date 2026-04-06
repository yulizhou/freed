import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSimpleIntroSection,
  getSimpleSystemSection,
  getSimpleToneAndStyleSection,
  getOutputEfficiencySection,
} from '../sections/base.js'
import { getEnvInfoSection } from '../sections/env.js'
import { getToolsSection } from '../sections/tools.js'
import { getMemorySection } from '../sections/memory.js'
import { getLanguageSection } from '../sections/language.js'
import { getSkillsSection } from '../sections/skills.js'
import type { EnvContext, ToolDescriptor, Skill } from '../../shared/index.js'

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetMemorySummary = vi.fn<() => Promise<string>>()

// ─── Tests: base sections ──────────────────────────────────────────────────────

describe('base sections', () => {
  it('getSimpleIntroSection returns a non-empty string', () => {
    const result = getSimpleIntroSection()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('Freed')
  })

  it('getSimpleSystemSection returns a non-empty string', () => {
    const result = getSimpleSystemSection()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('getSimpleToneAndStyleSection returns a non-empty string', () => {
    const result = getSimpleToneAndStyleSection()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('getOutputEfficiencySection returns a non-empty string', () => {
    const result = getOutputEfficiencySection()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('all base sections return strings (not arrays or objects)', () => {
    expect(typeof getSimpleIntroSection()).toBe('string')
    expect(typeof getSimpleSystemSection()).toBe('string')
    expect(typeof getSimpleToneAndStyleSection()).toBe('string')
    expect(typeof getOutputEfficiencySection()).toBe('string')
  })
})

// ─── Tests: env section ─────────────────────────────────────────────────────────

describe('env section', () => {
  const minimalEnv: EnvContext = {
    os: 'linux',
    shell: '/bin/zsh',
    cwd: '/home/user',
    nodeVersion: '22.0.0',
  }

  it('getEnvInfoSection returns a string', () => {
    const result = getEnvInfoSection(minimalEnv)
    expect(typeof result).toBe('string')
    expect(result).toContain('## Environment')
    expect(result).toContain('linux')
    expect(result).toContain('/bin/zsh')
    expect(result).toContain('/home/user')
    expect(result).toContain('22.0.0')
  })

  it('getEnvInfoSection omits optional fields when absent', () => {
    const result = getEnvInfoSection(minimalEnv)
    expect(result).not.toContain('Bun')
    expect(result).not.toContain('Git branch')
  })

  it('getEnvInfoSection includes bunVersion when present', () => {
    const env: EnvContext = { ...minimalEnv, bunVersion: '1.2.3' }
    const result = getEnvInfoSection(env)
    expect(result).toContain('Bun: 1.2.3')
  })

  it('getEnvInfoSection includes git fields when present', () => {
    const env: EnvContext = {
      ...minimalEnv,
      gitBranch: 'main',
      gitStatus: 'clean',
      gitChangedFiles: ['a.ts', 'b.ts'],
    }
    const result = getEnvInfoSection(env)
    expect(result).toContain('Git branch: main')
    expect(result).toContain('Git status: clean')
    expect(result).toContain('Changed files: a.ts, b.ts')
  })
})

// ─── Tests: tools section ──────────────────────────────────────────────────────

describe('tools section', () => {
  const makeTool = (name: string, riskLevel: ToolDescriptor['riskLevel'], desc?: string): ToolDescriptor =>
    ({ name, riskLevel, description: desc } as ToolDescriptor)

  it('getToolsSection returns a string for non-empty tools', () => {
    const tools = [makeTool('Read', 'safe', 'Read files')]
    const result = getToolsSection(tools)
    expect(typeof result).toBe('string')
    expect(result).toContain('## Available Tools')
    expect(result).toContain('[SAFE]')
    expect(result).toContain('Read')
    expect(result).toContain('Read files')
  })

  it('getToolsSection labels risk levels correctly', () => {
    const tools = [
      makeTool('safe_tool', 'safe'),
      makeTool('ask_tool', 'ask'),
      makeTool('deny_tool', 'deny'),
    ]
    const result = getToolsSection(tools)
    expect(result).toContain('[SAFE]')
    expect(result).toContain('[ASK]')
    expect(result).toContain('[DENY]')
  })

  it('getToolsSection returns "No tools" message for empty array', () => {
    const result = getToolsSection([])
    expect(result).toContain('No tools available')
  })

  it('getToolsSection uses "No description" when description is absent', () => {
    const tools = [makeTool('Read', 'safe')]
    const result = getToolsSection(tools)
    expect(result).toContain('No description')
  })
})

// ─── Tests: memory section ──────────────────────────────────────────────────────

describe('memory section', () => {
  beforeEach(() => {
    mockGetMemorySummary.mockReset()
  })

  it('getMemorySection returns a string when summary is non-empty', async () => {
    mockGetMemorySummary.mockResolvedValue('Yesterday I learned about the architecture.')
    const result = await getMemorySection(mockGetMemorySummary)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
    expect(result).toContain('## Memory Context')
    expect(result).toContain('Yesterday I learned')
  })

  it('getMemorySection returns null when summary is empty', async () => {
    mockGetMemorySummary.mockResolvedValue('')
    const result = await getMemorySection(mockGetMemorySummary)
    expect(result).toBeNull()
  })

  it('getMemorySection calls the provider function', async () => {
    mockGetMemorySummary.mockResolvedValue('test summary')
    await getMemorySection(mockGetMemorySummary)
    expect(mockGetMemorySummary).toHaveBeenCalledTimes(1)
  })
})

// ─── Tests: language section ───────────────────────────────────────────────────

describe('language section', () => {
  it('getLanguageSection uses default "English" when language is undefined', () => {
    const result = getLanguageSection(undefined)
    expect(typeof result).toBe('string')
    expect(result).toContain('English')
  })

  it('getLanguageSection uses provided language', () => {
    const result = getLanguageSection('Japanese')
    expect(typeof result).toBe('string')
    expect(result).toContain('Japanese')
  })

  it('getLanguageSection returns a string containing Language & Scope heading', () => {
    const result = getLanguageSection('French')
    expect(result).toContain('## Language & Scope')
  })
})

// ─── Tests: skills section ────────────────────────────────────────────────────

describe('skills section', () => {
  const makeSkill = (name: string, description?: string): Skill =>
    ({ name, description } as Skill)

  it('getSkillsSection returns null for empty skills array', () => {
    const result = getSkillsSection([])
    expect(result).toBeNull()
  })

  it('getSkillsSection returns a string for non-empty skills', () => {
    const skills = [makeSkill('my-skill', 'Does something useful')]
    const result = getSkillsSection(skills)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
    expect(result).toContain('## Available Skills')
    expect(result).toContain('my-skill')
    expect(result).toContain('Does something useful')
  })

  it('getSkillsSection uses "No description" when description is absent', () => {
    const skills = [makeSkill('bare-skill')]
    const result = getSkillsSection(skills)
    expect(result).toContain('No description')
  })

  it('getSkillsSection includes invocation instructions', () => {
    const skills = [makeSkill('test', 'desc')]
    const result = getSkillsSection(skills)
    expect(result).toContain('invoke it at the start of your turn')
    expect(result).toContain('Skill content is loaded on demand')
  })
})
