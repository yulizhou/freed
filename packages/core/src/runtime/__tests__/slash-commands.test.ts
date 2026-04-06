import { describe, it, expect, vi } from 'vitest';
import { createBuiltinCommands, SlashCommandRegistry } from '../slash-commands.js';
import type { SlashCommandContext } from '../slash-commands.js';
import type { AgentProfile } from '../../shared/index.js';

const mockCtx: SlashCommandContext = {
  session: { messages: [] },
  agentProfile: {
    id: 'coder',
    name: 'Coder',
    model: 'anthropic/claude-opus-4-5',
    systemPrompt: '',
    tools: ['shell', 'read_file'],
  } satisfies AgentProfile,
  envContext: {
    os: 'darwin',
    shell: '/bin/zsh',
    cwd: '/home/user/project',
    nodeVersion: '22.0.0',
    gitBranch: 'main',
    gitChangedFiles: ['src/index.ts', 'README.md'],
  },
};

describe('SlashCommandRegistry', () => {
  it('should register and detect commands', () => {
    const registry = new SlashCommandRegistry();
    registry.register('hello', 'Says hello', async () => 'hello!');
    expect(registry.has('hello')).toBe(true);
    expect(registry.has('missing')).toBe(false);
  });

  it('should execute a registered command', async () => {
    const registry = new SlashCommandRegistry();
    registry.register('echo', 'Echoes args', async (args) => args.join(' '));
    const result = await registry.execute('echo', ['foo', 'bar'], mockCtx);
    expect(result).toBe('foo bar');
  });

  it('should return error message for unknown command', async () => {
    const registry = new SlashCommandRegistry();
    const result = await registry.execute('unknown', [], mockCtx);
    expect(result).toContain('Unknown command');
  });

  it('should list registered commands', () => {
    const registry = new SlashCommandRegistry();
    registry.register('a', 'desc a', async () => '');
    registry.register('b', 'desc b', async () => '');
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.name)).toContain('a');
  });
});

describe('createBuiltinCommands', () => {
  it('/clear should call onClear callback', async () => {
    const onClear = vi.fn();
    const onQuit = vi.fn();
    const registry = createBuiltinCommands(onClear, onQuit);
    await registry.execute('clear', [], mockCtx);
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('/quit should call onQuit callback', async () => {
    const onClear = vi.fn();
    const onQuit = vi.fn();
    const registry = createBuiltinCommands(onClear, onQuit);
    await registry.execute('quit', [], mockCtx);
    expect(onQuit).toHaveBeenCalledOnce();
  });

  it('/exit should call onQuit callback', async () => {
    const onClear = vi.fn();
    const onQuit = vi.fn();
    const registry = createBuiltinCommands(onClear, onQuit);
    await registry.execute('exit', [], mockCtx);
    expect(onQuit).toHaveBeenCalledOnce();
  });

  it('/tools should list agent tools', async () => {
    const registry = createBuiltinCommands(() => void 0, () => void 0);
    const result = await registry.execute('tools', [], mockCtx);
    expect(result).toContain('shell');
    expect(result).toContain('read_file');
  });

  it('/bug should mention changed files count', async () => {
    const registry = createBuiltinCommands(() => void 0, () => void 0);
    const result = await registry.execute('bug', [], mockCtx);
    expect(result).toContain('2 changed file(s)');
  });

  it('/agents should require an argument', async () => {
    const onAgentSwitch = vi.fn().mockResolvedValue('Switched!');
    const registry = createBuiltinCommands(() => void 0, () => void 0, onAgentSwitch);
    const noArgResult = await registry.execute('agents', [], mockCtx);
    expect(noArgResult).toContain('Usage');
    expect(onAgentSwitch).not.toHaveBeenCalled();
  });

  it('/agents should call onAgentSwitch with the agent id', async () => {
    const onAgentSwitch = vi.fn().mockResolvedValue('Switched to reviewer');
    const registry = createBuiltinCommands(() => void 0, () => void 0, onAgentSwitch);
    const result = await registry.execute('agents', ['reviewer'], mockCtx);
    expect(onAgentSwitch).toHaveBeenCalledWith('reviewer');
    expect(result).toBe('Switched to reviewer');
  });
});
