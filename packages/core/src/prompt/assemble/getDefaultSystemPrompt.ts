/**
 * Builds the default system prompt as a string[].
 * Static sections come before SYSTEM_PROMPT_DYNAMIC_BOUNDARY.
 * Dynamic sections come after.
 */
import type { SystemPrompt, PromptSection } from '../types.js'
import {
  systemPromptSection,
  uncachedSystemPromptSection,
  resolveSystemPromptSections,
} from '../sectionRegistry.js'
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../types.js'
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
import type { EnvContext, ToolDescriptor } from '../../shared/index.js'
import type { Skill } from '../../skills/index.js'

export async function getDefaultSystemPrompt({
  tools,
  env,
  skills,
  getMemorySummary,
  settingsLanguage,
}: {
  tools: ToolDescriptor[]
  env: EnvContext
  skills: Skill[]
  getMemorySummary: () => Promise<string>
  settingsLanguage?: string
}): Promise<SystemPrompt> {
  // Static sections - cached, before boundary
  const staticSections: string[] = [
    getSimpleIntroSection(),
    getSimpleSystemSection(),
    getSimpleToneAndStyleSection(),
    getOutputEfficiencySection(),
  ]

  // Dynamic sections - resolved at runtime
  const dynamicSections = [
    systemPromptSection('tools', () =>
      Promise.resolve(getToolsSection(tools)),
    ),
    systemPromptSection('env', () => Promise.resolve(getEnvInfoSection(env))),
    systemPromptSection('language', () =>
      Promise.resolve(getLanguageSection(settingsLanguage)),
    ),
    systemPromptSection('skills', () =>
      Promise.resolve(getSkillsSection(skills)),
    ),
    // Memory is uncached because it changes per-session
    uncachedSystemPromptSection(
      'memory',
      async () => {
        const summary = await getMemorySummary()
        return summary ? `## Memory Context\n\n${summary}` : null
      },
      'Memory changes every session',
    ),
  ]

  const resolvedDynamic = await resolveSystemPromptSections(dynamicSections)

  return [
    ...staticSections,
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
    ...resolvedDynamic.filter((s): s is string => s !== null),
  ]
}
