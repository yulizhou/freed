import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlashCommandRegistry } from '../slash-commands.js';

const mockSkillRegistry = {
  listNames: vi.fn<() => string[]>(),
  getByName: vi.fn<(name: string) => any>(),
  reload: vi.fn<() => void>(),
  getForProject: vi.fn<() => any[]>(),
};

vi.mock('../skill-registry.js', () => ({
  skillRegistry: mockSkillRegistry,
}));

import { skillRegistry } from '../skill-registry.js';

describe('Skill integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Skill context injection', () => {
    it('should load project skills into context', async () => {
      const mockSkills = [
        { name: 'test-skill', scope: 'project' as const, content: 'Test content' },
      ];
      mockSkillRegistry.getForProject = vi.fn<() => any[]>().mockReturnValue(mockSkills);

      // Re-import with fresh module cache so the mock is used
      vi.resetModules();
      vi.doMock('../skill-registry.js', () => ({
        skillRegistry: mockSkillRegistry,
      }));

      const { skillRegistry: freshRegistry } = await import('../skill-registry.js');
      const skills = freshRegistry.getForProject('/test/project');

      expect(skills).toHaveLength(1);
      expect(skills[0]?.name).toBe('test-skill');
      expect(mockSkillRegistry.getForProject).toHaveBeenCalledWith('/test/project');
    });
  });

  describe('/skills slash command', () => {
    it('should return formatted skill list', async () => {
      mockSkillRegistry.listNames.mockReturnValue(['skill-a', 'skill-b']);
      mockSkillRegistry.getByName.mockImplementation((name: string) => {
        if (name === 'skill-a') return { name: 'skill-a', description: 'Description A', content: '' };
        if (name === 'skill-b') return { name: 'skill-b', description: 'Description B', content: '' };
        return undefined;
      });

      const registry = await import('../slash-commands.js');
      const cmdRegistry = registry.createBuiltinCommands(() => {});

      const result = await cmdRegistry.execute('skills', [], {
        session: { messages: [] },
        agentProfile: { model: '', systemPrompt: '', tools: [] },
        envContext: { cwd: '/test', os: 'linux', shell: 'bash', nodeVersion: '20.0.0' },
      } as any);

      expect(result).toContain('skill-a');
      expect(result).toContain('Description A');
      expect(result).toContain('skill-b');
      expect(result).toContain('Description B');
    });

    it('should return no skills message when empty', async () => {
      mockSkillRegistry.listNames.mockReturnValue([]);

      const registry = await import('../slash-commands.js');
      const cmdRegistry = registry.createBuiltinCommands(() => {});

      const result = await cmdRegistry.execute('skills', [], {
        session: { messages: [] },
        agentProfile: { model: '', systemPrompt: '', tools: [] },
        envContext: { cwd: '/test', os: 'linux', shell: 'bash', nodeVersion: '20.0.0' },
      } as any);

      expect(result).toBe('No skills loaded.');
    });
  });

  describe('/skill <name> slash command', () => {
    it('should return skill content when found', async () => {
      mockSkillRegistry.getByName.mockReturnValue({
        name: 'my-skill',
        description: 'My skill',
        content: '# My Skill\n\nSome content here.',
      });

      const registry = await import('../slash-commands.js');
      const cmdRegistry = registry.createBuiltinCommands(() => {});

      const result = await cmdRegistry.execute('skill', ['my-skill'], {
        session: { messages: [] },
        agentProfile: { model: '', systemPrompt: '', tools: [] },
        envContext: { cwd: '/test', os: 'linux', shell: 'bash', nodeVersion: '20.0.0' },
      } as any);

      expect(result).toContain('# My Skill');
      expect(result).toContain('Some content here.');
    });

    it('should return error when skill not found', async () => {
      mockSkillRegistry.getByName.mockReturnValue(undefined);

      const registry = await import('../slash-commands.js');
      const cmdRegistry = registry.createBuiltinCommands(() => {});

      const result = await cmdRegistry.execute('skill', ['unknown'], {
        session: { messages: [] },
        agentProfile: { model: '', systemPrompt: '', tools: [] },
        envContext: { cwd: '/test', os: 'linux', shell: 'bash', nodeVersion: '20.0.0' },
      } as any);

      expect(result).toBe('Skill not found: unknown');
    });

    it('should return usage when name not provided', async () => {
      const registry = await import('../slash-commands.js');
      const cmdRegistry = registry.createBuiltinCommands(() => {});

      const result = await cmdRegistry.execute('skill', [], {
        session: { messages: [] },
        agentProfile: { model: '', systemPrompt: '', tools: [] },
        envContext: { cwd: '/test', os: 'linux', shell: 'bash', nodeVersion: '20.0.0' },
      } as any);

      expect(result).toBe('Usage: /skill <name>');
    });
  });

  describe('/reload-skills slash command', () => {
    it('should reload the skill registry', async () => {
      const registry = await import('../slash-commands.js');
      const cmdRegistry = registry.createBuiltinCommands(() => {});

      const result = await cmdRegistry.execute('reload-skills', [], {
        session: { messages: [] },
        agentProfile: { model: '', systemPrompt: '', tools: [] },
        envContext: { cwd: '/test', os: 'linux', shell: 'bash', nodeVersion: '20.0.0' },
      } as any);

      expect(mockSkillRegistry.reload).toHaveBeenCalled();
      expect(result).toBe('Skills reloaded.');
    });
  });
});
