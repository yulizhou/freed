import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../skill-registry.js';
import type { Skill } from '../skill.js';

function makeSkill(name: string, scope: 'system' | 'user' | 'project', rootPath = '/test'): Skill {
  return {
    name,
    description: `Description for ${name}`,
    content: `# ${name}`,
    scope,
    rootPath,
  };
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('register and listNames', () => {
    const skills = [makeSkill('skill-a', 'system'), makeSkill('skill-b', 'system')];
    registry.register('system', skills, '/system');

    const names = registry.listNames();

    expect(names).toContain('skill-a');
    expect(names).toContain('skill-b');
  });

  it('priority: project overrides user which overrides system', () => {
    registry.register('system', [makeSkill('dup', 'system')], '/system');
    registry.register('user', [makeSkill('dup', 'user')], '/user');
    registry.register('project', [makeSkill('dup', 'project')], '/project');

    const result = registry.getByName('dup');
    expect(result?.scope).toBe('project');
  });

  it('getByName returns skill when registered', () => {
    const skill = makeSkill('unique', 'system');
    registry.register('system', [skill], '/system');

    const result = registry.getByName('unique');

    expect(result).toBeDefined();
    expect(result?.name).toBe('unique');
  });

  it('getByName returns undefined when not found', () => {
    const result = registry.getByName('nonexistent');
    expect(result).toBeUndefined();
  });

  it('getForProject returns project and system skills', () => {
    registry.register('system', [makeSkill('sys-skill', 'system')], '/system');
    registry.register('user', [makeSkill('user-skill', 'user')], '/user');
    registry.register('project', [makeSkill('proj-skill', 'project')], '/project');

    const result = registry.getForProject('/some/project');

    expect(result.map((s) => s.name)).toContain('sys-skill');
    expect(result.map((s) => s.name)).toContain('proj-skill');
    expect(result.map((s) => s.name)).not.toContain('user-skill');
  });

  it('getForProject with allowedSkills filters by name', () => {
    registry.register('system', [makeSkill('a', 'system'), makeSkill('b', 'system')], '/system');

    const result = registry.getForProject('/some/project', ['a']);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('a');
  });

  it('reload re-reads all registered root paths', () => {
    const skills1 = [makeSkill('skill-x', 'system')];
    registry.register('system', skills1, '/system');

    expect(registry.getByName('skill-x')).toBeDefined();

    registry.reload();

    expect(registry.listNames()).toContain('skill-x');
  });

  it('getAll returns all registered skills', () => {
    registry.register('system', [makeSkill('s1', 'system')], '/system');
    registry.register('user', [makeSkill('u1', 'user')], '/user');
    registry.register('project', [makeSkill('p1', 'project')], '/project');

    const all = registry.getAll();

    expect(all).toHaveLength(3);
  });
});
