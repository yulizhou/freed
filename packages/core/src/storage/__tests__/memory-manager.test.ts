import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from '../memory-manager.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'freed-test-'));
    manager = new MemoryManager({
      globalDir: path.join(tmpDir, 'global'),
      projectDir: path.join(tmpDir, 'project'),
    });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('write', () => {
    it('should write a memory entry and return metadata', async () => {
      const entry = await manager.write('global', 'Use pnpm for package management.', ['tooling']);
      expect(entry.id).toBeTruthy();
      expect(entry.scope).toBe('global');
      expect(entry.content).toBe('Use pnpm for package management.');
      expect(entry.tags).toContain('tooling');
      expect(entry.updatedAt).toBeInstanceOf(Date);
    });

    it('should persist the memory file on disk', async () => {
      const entry = await manager.write('global', 'Test memory');
      const files = await fs.readdir(path.join(tmpDir, 'global'));
      expect(files).toContain(`${entry.id}.md`);
    });
  });

  describe('read', () => {
    it('should return empty array when directory does not exist', async () => {
      const entries = await manager.read('session');
      expect(entries).toEqual([]);
    });

    it('should read back written memory entries', async () => {
      await manager.write('project', 'API must have tests.', ['testing']);
      await manager.write('project', 'Follow ESLint rules.', ['linting']);

      const entries = await manager.read('project');
      expect(entries).toHaveLength(2);
      const contents = entries.map((e) => e.content);
      expect(contents).toContain('API must have tests.');
      expect(contents).toContain('Follow ESLint rules.');
    });

    it('should sort entries by updatedAt descending', async () => {
      await manager.write('global', 'First entry');
      await new Promise((r) => setTimeout(r, 10));
      await manager.write('global', 'Second entry');

      const entries = await manager.read('global');
      expect(entries[0]?.content).toBe('Second entry');
    });
  });

  describe('buildContextSummary', () => {
    it('should return empty string when no memories exist', async () => {
      const summary = await manager.buildContextSummary(['global', 'project']);
      expect(summary).toBe('');
    });

    it('should combine memories from multiple scopes', async () => {
      await manager.write('global', 'Global preference: verbose logging.');
      await manager.write('project', 'Project uses React.');

      const summary = await manager.buildContextSummary(['global', 'project']);
      expect(summary).toContain('global memory');
      expect(summary).toContain('project memory');
      expect(summary).toContain('Global preference: verbose logging.');
      expect(summary).toContain('Project uses React.');
    });
  });

  describe('clear', () => {
    it('should delete all markdown files in a scope', async () => {
      await manager.write('global', 'Entry 1');
      await manager.write('global', 'Entry 2');

      await manager.clear('global');
      const entries = await manager.read('global');
      expect(entries).toHaveLength(0);
    });

    it('should not throw if directory does not exist', async () => {
      await expect(manager.clear('session')).resolves.not.toThrow();
    });
  });
});
