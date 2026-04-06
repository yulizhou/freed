import { describe, it, expect } from 'vitest';
import { AgentsLoader } from '../agents-loader.js';

describe('AgentsLoader', () => {
  const loader = new AgentsLoader();

  describe('parse', () => {
    it('should parse a single agent section', () => {
      const content = `---
version: 1
---

## coder
model: anthropic/claude-opus-4-5
tools: [shell, read_file, patch]

You are a coding assistant.
`;

      const profiles = loader.parse(content);
      expect(profiles).toHaveLength(1);
      const [coder] = profiles;
      expect(coder?.id).toBe('coder');
      expect(coder?.name).toBe('coder');
      expect(coder?.model).toBe('anthropic/claude-opus-4-5');
      expect(coder?.tools).toEqual(['shell', 'read_file', 'patch']);
      expect(coder?.systemPrompt).toBe('You are a coding assistant.');
    });

    it('should parse multiple agent sections', () => {
      const content = `## coder
model: openai/gpt-4o
tools: [shell]

You write code.

## reviewer
model: anthropic/claude-haiku-20240307
tools: [git_diff]

You review code.
`;
      const profiles = loader.parse(content);
      expect(profiles).toHaveLength(2);
      expect(profiles[0]?.id).toBe('coder');
      expect(profiles[1]?.id).toBe('reviewer');
    });

    it('should use default model when model line is missing', () => {
      const content = `## helper
tools: [read_file]

You help.
`;
      const profiles = loader.parse(content);
      expect(profiles[0]?.model).toBe('anthropic/claude-opus-4-5');
    });

    it('should use empty tools array when tools line is missing', () => {
      const content = `## helper

You help without tools.
`;
      const profiles = loader.parse(content);
      expect(profiles[0]?.tools).toEqual([]);
    });

    it('should handle multi-line system prompt', () => {
      const content = `## analyst
model: openai/gpt-4o
tools: []

You are an analyst.
You analyze data carefully.
Always double-check your work.
`;
      const profiles = loader.parse(content);
      const prompt = profiles[0]?.systemPrompt ?? '';
      expect(prompt).toContain('You are an analyst.');
      expect(prompt).toContain('Always double-check your work.');
    });
  });

  describe('load', () => {
    it('should return default profiles when no agents.md exists', async () => {
      const l = new AgentsLoader('/nonexistent-path-xyz');
      const profiles = await l.load();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]?.id).toBe('coder');
    });
  });
});
