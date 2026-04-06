/**
 * Builds the effective system prompt based on priority:
 * 0. overrideSystemPrompt -> REPLACE everything
 * 1. agentSystemPrompt (from AgentProfile) -> REPLACE default
 * 2. customSystemPrompt (CLI flag) -> REPLACE default
 * 3. defaultSystemPrompt -> base
 * Plus appendSystemPrompt always appended (except when override is set)
 */
import type { SystemPrompt, EffectiveSystemPrompt } from '../types.js'
import type { AgentProfile } from '@freed/shared'

export type BuildEffectiveSystemPromptParams = {
  mainThreadAgentDefinition?: AgentProfile
  customSystemPrompt?: string
  defaultSystemPrompt: SystemPrompt
  appendSystemPrompt?: string
  overrideSystemPrompt?: string | null
}

export function buildEffectiveSystemPrompt({
  mainThreadAgentDefinition,
  customSystemPrompt,
  defaultSystemPrompt,
  appendSystemPrompt,
  overrideSystemPrompt,
}: BuildEffectiveSystemPromptParams): EffectiveSystemPrompt {
  // Priority 0: override replaces everything
  if (overrideSystemPrompt) {
    return [overrideSystemPrompt]
  }

  // Determine the base prompt source
  let base: SystemPrompt

  if (mainThreadAgentDefinition?.systemPrompt) {
    // Priority 1: agent prompt replaces default
    base = [mainThreadAgentDefinition.systemPrompt]
  } else if (customSystemPrompt) {
    // Priority 2: custom replaces default
    base = [customSystemPrompt]
  } else {
    // Priority 3: use default
    base = defaultSystemPrompt
  }

  // appendSystemPrompt always appended (except when override is set)
  if (appendSystemPrompt) {
    return [...base, appendSystemPrompt]
  }

  return base
}
