import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AgentProfile } from '../shared/index.js';
import matter from 'gray-matter';

/**
 * Loads AgentProfile definitions from an agents.md file.
 *
 * Expected format:
 * ```md
 * ---
 * version: 1
 * ---
 *
 * ## coder
 * model: anthropic/claude-opus-4-5
 * tools: [shell, read_file, patch]
 *
 * You are a helpful coder agent.
 *
 * ## reviewer
 * model: openai/gpt-4o
 * tools: [git_diff, read_file]
 *
 * You review code changes for risk.
 * ```
 */
export class AgentsLoader {
  private readonly searchPaths: string[];

  constructor(projectRoot?: string) {
    const root = projectRoot ?? process.cwd();
    this.searchPaths = [
      path.join(root, '.freed', 'agents', 'agents.md'),
      path.join(os.homedir(), '.freed', 'agents', 'agents.md'),
    ];
  }

  async load(): Promise<AgentProfile[]> {
    for (const filePath of this.searchPaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return this.parse(content);
      } catch {
        // try next path
      }
    }
    return this.defaults();
  }

  parse(content: string): AgentProfile[] {
    const { content: body } = matter(content);
    const profiles: AgentProfile[] = [];

    // Split on H2 headings (## name)
    const sections = body.split(/^## /m).filter(Boolean);

    for (const section of sections) {
      const lines = section.split('\n');
      const firstLine = lines[0]?.trim();
      if (!firstLine) continue;

      const id = firstLine.toLowerCase().replace(/\s+/g, '-');
      const name = firstLine;

      let model = 'anthropic/claude-opus-4-5';
      let tools: string[] = [];
      let promptLines: string[] = [];
      let inPrompt = false;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const trimmed = line.trim();

        if (!inPrompt) {
          if (trimmed.startsWith('model:')) {
            model = trimmed.replace('model:', '').trim();
          } else if (trimmed.startsWith('tools:')) {
            const raw = trimmed.replace('tools:', '').trim();
            tools = raw
              .replace(/[[\]]/g, '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
          } else if (trimmed.length > 0) {
            inPrompt = true;
            promptLines.push(line);
          }
        } else {
          promptLines.push(line);
        }
      }

      profiles.push({
        id,
        name,
        model,
        systemPrompt: promptLines.join('\n').trim(),
        tools,
      });
    }

    return profiles;
  }

  private defaults(): AgentProfile[] {
    return [
      {
        id: 'coder',
        name: 'Coder',
        model: 'deepseek/deepseek-chat',
        systemPrompt:
          'You are a helpful coding assistant with access to tools that can read and write files, execute shell commands, and interact with git. Always be careful with destructive operations.',
        tools: ['shell', 'read_file', 'write_file', 'list_dir', 'git_status', 'git_diff'],
      },
    ];
  }
}
