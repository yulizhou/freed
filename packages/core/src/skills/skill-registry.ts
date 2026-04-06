import type { Skill, Scope } from './skill.js';

interface RootEntry {
  scope: Scope;
  rootPath: string;
  skills: Skill[];
}

export class SkillRegistry {
  // Maps skill name → skill (highest-priority scope wins)
  private byName: Map<string, Skill> = new Map();
  // Ordered roots for reload
  private roots: RootEntry[] = [];

  register(scope: Scope, skills: Skill[], rootPath: string): void {
    const existingRoot = this.roots.find((r) => r.rootPath === rootPath);
    if (existingRoot) {
      existingRoot.skills = skills;
    } else {
      this.roots.push({ scope, rootPath, skills });
    }

    for (const skill of skills) {
      const existing = this.byName.get(skill.name);

      if (!existing) {
        this.byName.set(skill.name, skill);
      } else {
        const existingPriority = this.scopePriority(existing.scope);
        const newPriority = this.scopePriority(scope);
        if (newPriority > existingPriority) {
          console.info(`Skill '${skill.name}' shadowed by project skill at ${rootPath}`);
          this.byName.set(skill.name, skill);
        }
      }
    }
  }

  private scopePriority(scope: Scope): number {
    return scope === 'project' ? 3 : scope === 'user' ? 2 : 1;
  }

  reload(): void {
    this.byName.clear();
    for (const { scope, rootPath, skills } of this.roots) {
      for (const skill of skills) {
        const existing = this.byName.get(skill.name);
        if (!existing) {
          this.byName.set(skill.name, skill);
        } else if (this.scopePriority(scope) > this.scopePriority(existing.scope)) {
          this.byName.set(skill.name, skill);
        }
      }
    }
  }

  getAll(): Skill[] {
    return Array.from(this.byName.values());
  }

  getForProject(projectPath: string): Skill[];
  getForProject(projectPath: string, allowedSkills: string[]): Skill[];
  getForProject(projectPath: string, allowedSkills?: string[]): Skill[] {
    const all = this.getAll();

    if (!allowedSkills) {
      return all.filter((s) => s.scope === 'project' || s.scope === 'system');
    }

    const allowed = new Set(allowedSkills);
    return all.filter(
      (s) => (s.scope === 'project' || s.scope === 'system') && allowed.has(s.name)
    );
  }

  getByName(name: string): Skill | undefined {
    return this.byName.get(name);
  }

  listNames(): string[] {
    return Array.from(this.byName.keys());
  }
}
