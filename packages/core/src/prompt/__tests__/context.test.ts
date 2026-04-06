import { describe, it, expect } from 'vitest'
import { getUserContext } from '../context/getUserContext.js'
import { getSystemContext } from '../context/getSystemContext.js'

// ─── getUserContext tests ───────────────────────────────────────────────────────

describe('getUserContext', () => {
  it('returns an object with date key', async () => {
    const date = new Date('2024-06-15T10:00:00.000Z')
    const result = await getUserContext({ sessionStartDate: date })
    expect(result).toHaveProperty('date')
  })

  it('date is formatted as YYYY-MM-DD', async () => {
    const date = new Date('2024-06-15T10:00:00.000Z')
    const result = await getUserContext({ sessionStartDate: date })
    expect(result.date).toBe('2024-06-15')
  })

  it('includes project name when provided', async () => {
    const date = new Date()
    const result = await getUserContext({
      projectName: 'my-cool-project',
      sessionStartDate: date,
    })
    expect(result).toHaveProperty('project')
    expect(result.project).toBe('my-cool-project')
  })

  it('omits project key when projectName is not provided', async () => {
    const date = new Date()
    const result = await getUserContext({ sessionStartDate: date })
    expect(result).not.toHaveProperty('project')
  })

  it('handles missing projectName gracefully', async () => {
    const date = new Date()
    const result = await getUserContext({
      projectName: undefined,
      sessionStartDate: date,
    })
    expect(result).not.toHaveProperty('project')
  })
})

// ─── getSystemContext tests ────────────────────────────────────────────────────

describe('getSystemContext', () => {
  it('returns an empty object when all inputs are undefined', () => {
    const result = getSystemContext({})
    expect(result).toEqual({})
  })

  it('includes git_branch when provided', () => {
    const result = getSystemContext({ gitBranch: 'main' })
    expect(result).toHaveProperty('git_branch')
    expect(result.git_branch).toBe('main')
  })

  it('omits git_branch when not provided', () => {
    const result = getSystemContext({ gitBranch: undefined })
    expect(result).not.toHaveProperty('git_branch')
  })

  it('includes git_status when provided', () => {
    const result = getSystemContext({ gitStatus: 'M src/index.ts' })
    expect(result).toHaveProperty('git_status')
    expect(result.git_status).toBe('M src/index.ts')
  })

  it('omits git_status when not provided', () => {
    const result = getSystemContext({ gitStatus: undefined })
    expect(result).not.toHaveProperty('git_status')
  })

  it('includes cache_breaker when provided', () => {
    const result = getSystemContext({ promptHash: 'abc123' })
    expect(result).toHaveProperty('cache_breaker')
    expect(result.cache_breaker).toBe('abc123')
  })

  it('omits cache_breaker when not provided', () => {
    const result = getSystemContext({ promptHash: undefined })
    expect(result).not.toHaveProperty('cache_breaker')
  })

  it('returns all provided fields together', () => {
    const result = getSystemContext({
      gitBranch: 'feature/new',
      gitStatus: '?? newfile.txt',
      promptHash: 'hashxyz',
    })
    expect(result.git_branch).toBe('feature/new')
    expect(result.git_status).toBe('?? newfile.txt')
    expect(result.cache_breaker).toBe('hashxyz')
  })
})
