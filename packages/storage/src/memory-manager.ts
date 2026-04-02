import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import matter from 'gray-matter';
import { nanoid } from 'nanoid';
import type { MemoryEntry, MemoryScope } from '@freed/shared';

export interface MemoryManagerOptions {
  globalDir?: string;
  projectDir?: string;
}

export interface MemoryFile {
  filePath: string;
  scope: MemoryScope;
  tags: string[];
  updatedAt: Date;
  confidence?: 'low' | 'medium' | 'high' | undefined;
  content: string;
}

/**
 * Manages Markdown-based memory files.
 *
 * Directory layout:
 *   ~/.freed/memory/global/    ← global memories
 *   ~/.freed/memory/agents/    ← agent-specific memories
 *   <project>/.freed/memory/project/  ← project memories
 *   <project>/.freed/memory/session/  ← session memories
 */
export class MemoryManager {
  private readonly globalDir: string;
  private readonly projectDir: string;

  constructor(options: MemoryManagerOptions = {}) {
    this.globalDir = options.globalDir ?? path.join(os.homedir(), '.freed', 'memory', 'global');
    this.projectDir = options.projectDir ?? path.join(process.cwd(), '.freed', 'memory', 'project');
  }

  private dirForScope(scope: MemoryScope): string {
    switch (scope) {
      case 'global':
        return this.globalDir;
      case 'project':
        return this.projectDir;
      case 'session':
        return path.join(path.dirname(this.projectDir), 'session');
      case 'agent':
        return path.join(os.homedir(), '.freed', 'memory', 'agents');
    }
  }

  async write(scope: MemoryScope, content: string, tags: string[] = []): Promise<MemoryEntry> {
    const dir = this.dirForScope(scope);
    await fs.mkdir(dir, { recursive: true });

    const id = nanoid();
    const now = new Date();
    const filePath = path.join(dir, `${id}.md`);

    const frontmatter = matter.stringify(content, {
      scope,
      tags,
      updated_at: now.toISOString(),
    });

    await fs.writeFile(filePath, frontmatter, 'utf-8');

    return {
      id,
      scope,
      content,
      tags,
      updatedAt: now,
    };
  }

  async read(scope: MemoryScope): Promise<MemoryFile[]> {
    const dir = this.dirForScope(scope);

    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      return [];
    }

    const entries: MemoryFile[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(raw);

      entries.push({
        filePath,
        scope: (parsed.data['scope'] as MemoryScope | undefined) ?? scope,
        tags: Array.isArray(parsed.data['tags']) ? (parsed.data['tags'] as string[]) : [],
        updatedAt: parsed.data['updated_at'] ? new Date(parsed.data['updated_at'] as string) : new Date(0),
        confidence: parsed.data['confidence'] as 'low' | 'medium' | 'high' | undefined,
        content: parsed.content.trim(),
      });
    }

    return entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Read all memories merged across scopes, ordered: global → project → session.
   * Returns a single string suitable for injection into a system prompt.
   */
  async buildContextSummary(scopes: MemoryScope[] = ['global', 'project']): Promise<string> {
    const sections: string[] = [];

    for (const scope of scopes) {
      const entries = await this.read(scope);
      if (entries.length === 0) continue;

      const body = entries.map((e) => e.content).join('\n\n');
      sections.push(`## ${scope} memory\n\n${body}`);
    }

    return sections.join('\n\n---\n\n');
  }

  async delete(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  async clear(scope: MemoryScope): Promise<void> {
    const dir = this.dirForScope(scope);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      return;
    }
    await Promise.all(files.filter((f) => f.endsWith('.md')).map((f) => fs.unlink(path.join(dir, f))));
  }
}
