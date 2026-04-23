import { describe, it, expect } from 'vitest'
import { splitSysPromptPrefix } from '../transport/splitSystemPromptBlocks.js'
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../types.js'

describe('splitSysPromptPrefix', () => {
  it('returns a non-empty array of PromptBlocks', () => {
    const result = splitSysPromptPrefix(['hello', 'world'])
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('content')
    expect(result[0]).toHaveProperty('cacheScope')
  })

  it('split on boundary: content before boundary gets cacheScope=global', () => {
    const prompt = [
      'static section 1',
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'dynamic section',
    ]
    const result = splitSysPromptPrefix(prompt)
    const globalBlock = result.find((b) => b.cacheScope === 'global')
    expect(globalBlock).toBeDefined()
    expect(globalBlock?.content).toContain('static section 1')
    expect(globalBlock?.content).not.toContain('dynamic section')
  })

  it('split on boundary: content after boundary gets cacheScope=null', () => {
    const prompt = [
      'static section',
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'dynamic content',
    ]
    const result = splitSysPromptPrefix(prompt)
    const dynamicBlock = result.find((b) => b.cacheScope === null)
    expect(dynamicBlock).toBeDefined()
    expect(dynamicBlock?.content).toContain('dynamic content')
    expect(dynamicBlock?.content).not.toContain('static section')
  })

  it('returns a single block with cacheScope=null when no boundary exists', () => {
    const prompt = ['all dynamic content', 'more content']
    const result = splitSysPromptPrefix(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]!.cacheScope).toBeNull()
    expect(result[0]!.content).toContain('all dynamic content')
  })

  it('skipGlobalCache=true returns single block with cacheScope=null', () => {
    const prompt = ['static', SYSTEM_PROMPT_DYNAMIC_BOUNDARY, 'dynamic']
    const result = splitSysPromptPrefix(prompt, { skipGlobalCacheForSystemPrompt: true })
    expect(result).toHaveLength(1)
    expect(result[0]!.cacheScope).toBeNull()
    expect(result[0]!.content).toContain('static')
    expect(result[0]!.content).toContain('dynamic')
  })

  it('static block is null when all content is after boundary', () => {
    const prompt = [
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'dynamic only',
    ]
    const result = splitSysPromptPrefix(prompt)
    const globalBlock = result.find((b) => b.cacheScope === 'global')
    expect(globalBlock).toBeUndefined()
  })

  it('dynamic block is null when all content is before boundary', () => {
    const prompt = ['static 1', 'static 2']
    const result = splitSysPromptPrefix(prompt)
    // No boundary, so all content gets cacheScope=null as a single block
    expect(result).toHaveLength(1)
    expect(result[0]!.cacheScope).toBeNull()
  })

  it('handles prompt with only boundary marker', () => {
    const prompt = [SYSTEM_PROMPT_DYNAMIC_BOUNDARY]
    const result = splitSysPromptPrefix(prompt)
    // No actual content before or after boundary → empty result
    expect(result).toHaveLength(0)
  })

  it('blocks are joined with double newlines', () => {
    const prompt = [
      'section 1',
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'section 2',
    ]
    const result = splitSysPromptPrefix(prompt)
    const globalBlock = result.find((b) => b.cacheScope === 'global')
    const dynamicBlock = result.find((b) => b.cacheScope === null)
    expect(globalBlock?.content).toContain('section 1')
    expect(dynamicBlock?.content).toContain('section 2')
  })

  it('multiple static sections before boundary are joined together', () => {
    const prompt = [
      'intro',
      'capabilities',
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'dynamic',
    ]
    const result = splitSysPromptPrefix(prompt)
    const globalBlock = result.find((b) => b.cacheScope === 'global')
    expect(globalBlock?.content).toContain('intro')
    expect(globalBlock?.content).toContain('capabilities')
  })

  it('multiple dynamic sections after boundary are joined together', () => {
    const prompt = [
      'static',
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'dynamic 1',
      'dynamic 2',
    ]
    const result = splitSysPromptPrefix(prompt)
    const dynamicBlock = result.find((b) => b.cacheScope === null)
    expect(dynamicBlock?.content).toContain('dynamic 1')
    expect(dynamicBlock?.content).toContain('dynamic 2')
  })

  it('skips empty string blocks in prompt', () => {
    const prompt = ['content', '', SYSTEM_PROMPT_DYNAMIC_BOUNDARY, 'dynamic']
    const result = splitSysPromptPrefix(prompt)
    expect(result).toHaveLength(2)
  })

  it('skips the boundary marker itself in output content', () => {
    const prompt = ['static', SYSTEM_PROMPT_DYNAMIC_BOUNDARY, 'dynamic']
    const result = splitSysPromptPrefix(prompt)
    for (const block of result) {
      expect(block.content).not.toContain(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
    }
  })
})
