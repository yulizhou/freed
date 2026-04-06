export interface Skill {
  name: string;
  description: string;
  content: string; // body after frontmatter
  scope: 'system' | 'user' | 'project';
  rootPath: string;
}

export type Scope = 'system' | 'user' | 'project';

/**
 * Context passed to skill template rendering.
 * Carries everything needed to resolve relative paths and environment.
 */
export type ToolUseContext = {
  cwd: string;
  env: Record<string, string>;
}

/**
 * A skill that can be invoked with arguments.
 * The prompt content is loaded on demand via getPromptForCommand.
 */
export type SkillArgument = {
  name: string;
  description?: string;
}

export type SkillTemplate = {
  name: string;
  description: string;
  baseDir?: string;
  arguments?: SkillArgument[];
  /**
   * Load and render the full skill prompt with arguments substituted.
   */
  getPromptForCommand(
    args: Record<string, string>,
    toolUseContext: ToolUseContext,
  ): Promise<string>;
};
