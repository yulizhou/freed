/**
 * Language and scope settings section.
 */

export function getLanguageSection(settingsLanguage?: string): string {
  const lang = settingsLanguage ?? 'English'
  return `## Language & Scope

Primary language: ${lang}

When answering:
- Use ${lang} for all communication
- Code, file paths, and technical terms are language-agnostic
- Adjust formality based on context - technical content stays concise`
}
