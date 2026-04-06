/**
 * Boundary marker separating static (cross-org cacheable) content from dynamic content.
 * Everything BEFORE this marker can use scope 'global'.
 * Everything AFTER contains user/session-specific content.
 */
export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY =
  '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'

/**
 * Function that computes a prompt section value.
 * Returns string | null | Promise<string | null>
 */
export type ComputeFn = () =>
  | string
  | null
  | Promise<string | null>

/**
 * A named, memoized prompt section.
 * - cacheBreak: if true, recomputes every turn (breaks prompt cache)
 * - if false, cached until explicitly cleared
 */
export type PromptSection = {
  name: string
  compute: ComputeFn
  cacheBreak: boolean
}

/**
 * System prompt as array of string blocks.
 * Using array (not single string) enables static/dynamic splits and per-block cacheScope.
 */
export type SystemPrompt = string[]

/**
 * A block of system prompt with cache control metadata.
 * Used at the transport layer for API-level caching.
 */
export type PromptBlock = {
  content: string
  cacheScope: 'global' | 'org' | null // null = no cache
}

/**
 * Priority-based prompt override result.
 * All sections are joined in order; null/undefined entries are filtered out.
 */
export type EffectiveSystemPrompt = SystemPrompt

/**
 * User context injected as meta user message (not system prompt).
 */
export type UserContext = { [key: string]: string }

/**
 * System context appended to system prompt as key:value lines.
 */
export type SystemContext = { [key: string]: string }

/**
 * Dynamic attachment for the current turn.
 * These carry per-turn information via system-reminder messages.
 */
export type PromptAttachment =
  | { type: 'skill_discovery'; skills: { name: string; description: string }[] }
  | { type: 'mcp_delta'; added?: string[]; removed?: string[] }
  | { type: 'relevant_memories'; memories: { scope: string; content: string }[] }
