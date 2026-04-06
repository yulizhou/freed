import type { PromptSection, ComputeFn } from './types.js'

/**
 * Module-level cache for non-cacheBreaking sections.
 */
const sectionCache = new Map<string, string | null>()

export function getSectionCache(): Map<string, string | null> {
  return sectionCache
}

export function setSectionCacheEntry(name: string, value: string | null): void {
  sectionCache.set(name, value)
}

export function clearSectionCache(): void {
  sectionCache.clear()
}

/**
 * Create a memoized system prompt section.
 * Computed once, cached until /clear or explicit invalidation.
 */
export function systemPromptSection(
  name: string,
  compute: ComputeFn,
): PromptSection {
  return { name, compute, cacheBreak: false }
}

/**
 * Create a volatile section that recomputes every turn.
 * This WILL break the prompt cache when value changes.
 * Requires a reason explaining why cacheBreaking is necessary.
 */
export function uncachedSystemPromptSection(
  name: string,
  compute: ComputeFn,
  _reason: string,
): PromptSection {
  return { name, compute, cacheBreak: true }
}

/**
 * Resolve all sections, returning their computed string values.
 * Cached sections use memoization; uncached sections always recompute.
 */
export async function resolveSystemPromptSections(
  sections: PromptSection[],
): Promise<(string | null)[]> {
  return Promise.all(
    sections.map(async (s) => {
      if (!s.cacheBreak && sectionCache.has(s.name)) {
        return sectionCache.get(s.name) ?? null
      }
      const value = await s.compute()
      if (!s.cacheBreak) {
        sectionCache.set(s.name, value)
      }
      return value
    }),
  )
}
