/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadSkillsFromDir } from '../skill-loader.js';

describe('loadSkillsFromDir', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'skill-loader-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('loads valid skill files', async () => {
    const skillContent = `---\nname: test-skill\ndescription: A test skill\n---\n# Test content`;
    await fs.promises.mkdir(path.join(tmpDir, 'subdir'), { recursive: true });
    await fs.promises.writeFile(path.join(tmpDir, 'subdir', 'SKILL.md'), skillContent);

    const skills = await loadSkillsFromDir(tmpDir, 'project');

    expect(skills).toHaveLength(1);
    const skill = skills[0]!;
    expect(skill.name).toBe('test-skill');
    expect(skill.description).toBe('A test skill');
    expect(skill.content).toBe('# Test content');
    expect(skill.scope).toBe('project');
  });

  it('returns empty array when no SKILL.md found', async () => {
    await fs.promises.mkdir(path.join(tmpDir, 'subdir'), { recursive: true });
    await fs.promises.writeFile(path.join(tmpDir, 'subdir', 'README.md'), '# No skill');

    const skills = await loadSkillsFromDir(tmpDir, 'project');

    expect(skills).toHaveLength(0);
  });

  it('throws when name is missing', async () => {
    const skillContent = `---\ndescription: No name here\n---\n# Content`;
    await fs.promises.writeFile(path.join(tmpDir, 'SKILL.md'), skillContent);

    await expect(loadSkillsFromDir(tmpDir, 'project')).rejects.toThrow(
      "Missing 'name' field"
    );
  });

  it('throws when description is missing', async () => {
    const skillContent = `---\nname: my-skill\n---\n# Content`;
    await fs.promises.writeFile(path.join(tmpDir, 'SKILL.md'), skillContent);

    await expect(loadSkillsFromDir(tmpDir, 'project')).rejects.toThrow(
      "Missing 'description' field"
    );
  });

  it('throws on corrupt YAML', async () => {
    const skillContent = `---\nname: [invalid\n  yaml: broken\n---\n# Content`;
    await fs.promises.writeFile(path.join(tmpDir, 'SKILL.md'), skillContent);

    await expect(loadSkillsFromDir(tmpDir, 'project')).rejects.toThrow();
  });

  it('loads skills from nested directories', async () => {
    const skillContent = `---\nname: nested-skill\ndescription: Nested desc\n---\n# Content`;
    await fs.promises.mkdir(path.join(tmpDir, 'a', 'b', 'c'), { recursive: true });
    await fs.promises.writeFile(path.join(tmpDir, 'a', 'b', 'c', 'SKILL.md'), skillContent);

    const skills = await loadSkillsFromDir(tmpDir, 'system');

    expect(skills).toHaveLength(1);
    const skill = skills[0]!;
    expect(skill.name).toBe('nested-skill');
    expect(skill.scope).toBe('system');
  });

  it('skips files larger than 1 MB and logs warning', async () => {
    const largeContent = '---\nname: large-skill\ndescription: Large\n---\n' + 'x'.repeat(1024 * 1024 + 1);
    await fs.promises.writeFile(path.join(tmpDir, 'SKILL.md'), largeContent);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const skills = await loadSkillsFromDir(tmpDir, 'project');

    expect(skills).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('exceeds 1 MB limit')
    );
    warnSpy.mockRestore();
  });

  it('returns empty array when directory is empty', async () => {
    const skills = await loadSkillsFromDir(tmpDir, 'project');
    expect(skills).toHaveLength(0);
  });
});
