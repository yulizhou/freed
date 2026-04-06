import { describe, it, expect, beforeEach } from 'vitest'
import {
  systemPromptSection,
  uncachedSystemPromptSection,
  resolveSystemPromptSections,
  clearSectionCache,
} from '../sectionRegistry.js'

describe('sectionRegistry', () => {
  beforeEach(() => {
    clearSectionCache()
  })

  it('systemPromptSection creates a cached section', async () => {
    const section = systemPromptSection('test', () => Promise.resolve('hello'))
    expect(section.cacheBreak).toBe(false)
    expect(section.name).toBe('test')

    const [result] = await resolveSystemPromptSections([section])
    expect(result).toBe('hello')
  })

  it('uncachedSystemPromptSection creates an uncached section', async () => {
    const section = uncachedSystemPromptSection(
      'volatile',
      () => Promise.resolve('dynamic'),
      'changes every turn',
    )
    expect(section.cacheBreak).toBe(true)
  })

  it('cached sections are memoized', async () => {
    let callCount = 0
    const section = systemPromptSection('memo', async () => {
      callCount++
      return `called ${callCount} times`
    })

    await resolveSystemPromptSections([section])
    await resolveSystemPromptSections([section])
    await resolveSystemPromptSections([section])

    expect(callCount).toBe(1)
  })

  it('uncached sections recompute every time', async () => {
    let callCount = 0
    const section = uncachedSystemPromptSection(
      'nocache',
      async () => {
        callCount++
        return `called ${callCount} times`
      },
      'testing',
    )

    await resolveSystemPromptSections([section])
    await resolveSystemPromptSections([section])

    expect(callCount).toBe(2)
  })

  it('returns null for sections that return null', async () => {
    const section = systemPromptSection('nullsection', async () => null)
    const [result] = await resolveSystemPromptSections([section])
    expect(result).toBeNull()
  })
})
