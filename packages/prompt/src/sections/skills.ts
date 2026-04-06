/**
 * Skill invocation instructions section.
 * Shows how to use available skills.
 */
import type { Skill } from '@freed/skills'

export function getSkillsSection(skills: Skill[]): string | null {
  if (skills.length === 0) {
    return null
  }

  const lines = [
    `## Available Skills\n`,
    `Skills encode project-specific conventions and repeatable workflows.\n`,
    `To use a skill, invoke it at the start of your turn:\n`,
  ]

  for (const skill of skills) {
    lines.push(`- **${skill.name}**: ${skill.description ?? 'No description'}`)
  }

  lines.push(`\nSkill content is loaded on demand when invoked.`)

  return lines.join('\n')
}
