import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import type { Skill, Scope } from './skill.js';

export async function loadSkillsFromDir(dir: string, scope: Scope): Promise<Skill[]> {
  const pattern = path.join(dir, '**/SKILL.md');
  const files = await fg.glob(pattern, { absolute: true });
  const skills: Skill[] = [];

  for (const file of files) {
    const stats = await fs.promises.stat(file);
    const maxSize = 1 * 1024 * 1024; // 1 MB

    if (stats.size > maxSize) {
      console.warn(`Skipping skill '${file}': file size ${stats.size} exceeds 1 MB limit`);
      continue;
    }

    const raw = await fs.promises.readFile(file, 'utf-8');
    const { data, content } = matter(raw);

    const name = data.name as string | undefined;
    const description = data.description as string | undefined;

    if (!name) {
      throw new Error(`Missing 'name' field in ${file}`);
    }

    if (!description) {
      throw new Error(`Missing 'description' field in ${file}`);
    }

    const rootPath = path.dirname(file);

    skills.push({
      name,
      description,
      content,
      scope,
      rootPath,
    });
  }

  return skills;
}
