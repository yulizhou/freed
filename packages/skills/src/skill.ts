export interface Skill {
  name: string;
  description: string;
  content: string; // body after frontmatter
  scope: 'system' | 'user' | 'project';
  rootPath: string;
}

export type Scope = 'system' | 'user' | 'project';
