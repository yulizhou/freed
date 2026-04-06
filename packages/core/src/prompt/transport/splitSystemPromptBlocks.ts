/**
 * Transport layer: splits system prompt into API blocks with cacheScope.
 *
 * Blocks before SYSTEM_PROMPT_DYNAMIC_BOUNDARY → cacheScope='global'
 * Blocks after → cacheScope=null (user/session specific)
 */
import type { SystemPrompt, PromptBlock } from '../types.js'
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../types.js'

export function splitSysPromptPrefix(
  systemPrompt: SystemPrompt,
  options?: { skipGlobalCacheForSystemPrompt?: boolean },
): PromptBlock[] {
  const skipGlobalCache = options?.skipGlobalCacheForSystemPrompt ?? false

  if (skipGlobalCache) {
    // No global cache when MCP tools are present
    return [
      {
        content: systemPrompt.join('\n\n'),
        cacheScope: null,
      },
    ]
  }

  const boundaryIndex = systemPrompt.findIndex(
    (s) => s === SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  )

  if (boundaryIndex === -1) {
    // No boundary - all content is dynamic
    return [
      {
        content: systemPrompt.join('\n\n'),
        cacheScope: null,
      },
    ]
  }

  const staticContent: string[] = []
  const dynamicContent: string[] = []

  for (let i = 0; i < systemPrompt.length; i++) {
    const block = systemPrompt[i]
    if (!block || block === SYSTEM_PROMPT_DYNAMIC_BOUNDARY) continue

    if (i < boundaryIndex) {
      staticContent.push(block)
    } else {
      dynamicContent.push(block)
    }
  }

  const blocks: PromptBlock[] = []

  if (staticContent.length > 0) {
    blocks.push({
      content: staticContent.join('\n\n'),
      cacheScope: 'global',
    })
  }

  if (dynamicContent.length > 0) {
    blocks.push({
      content: dynamicContent.join('\n\n'),
      cacheScope: null,
    })
  }

  return blocks
}
