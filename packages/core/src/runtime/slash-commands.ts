import type { AgentProfile, EnvContext } from '../shared/index.js';
import { skillRegistry } from './skill-registry.js';

export type SlashCommandHandler = (
  args: string[],
  ctx: SlashCommandContext,
) => Promise<string>;

export interface SlashCommandContext {
  session: { messages: { role: string; content: string }[] };
  agentProfile: AgentProfile;
  envContext: EnvContext;
}

export class SlashCommandRegistry {
  private readonly commands = new Map<string, { description: string; handler: SlashCommandHandler }>();

  register(name: string, description: string, handler: SlashCommandHandler): void {
    this.commands.set(name, { description, handler });
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  async execute(name: string, args: string[], ctx: SlashCommandContext): Promise<string> {
    const cmd = this.commands.get(name);
    if (!cmd) return `Unknown command: /${name}`;
    return cmd.handler(args, ctx);
  }

  list(): { name: string; description: string }[] {
    return [...this.commands.entries()].map(([name, { description }]) => ({ name, description }));
  }
}

/**
 * Creates and registers the built-in slash commands.
 */
export function createBuiltinCommands(
  onClear: () => void,
  onAgentSwitch?: (agentId: string) => Promise<string>,
): SlashCommandRegistry {
  const registry = new SlashCommandRegistry();

  registry.register('clear', 'Clear the current session context', async (_args, _ctx) => {
    onClear();
    return 'Session context cleared.';
  });

  registry.register(
    'review',
    'Review the current git diff',
    async (_args, ctx) => {
      const { envContext } = ctx;
      return `Reviewing git changes in ${envContext.cwd}. Use the git_diff tool to inspect changes.`;
    },
  );

  registry.register(
    'bug',
    'Analyze a bug based on recent logs and changes',
    async (_args, ctx) => {
      const files = ctx.envContext.gitChangedFiles ?? [];
      return `Bug analysis context: ${files.length} changed file(s). Describe the error and I will help diagnose it.`;
    },
  );

  registry.register('tools', 'List available tools for the current agent', async (_args, ctx) => {
    return `Available tools: ${ctx.agentProfile.tools.join(', ')}`;
  });

  registry.register('memory', 'Show current memory context', async (_args, _ctx) => {
    return 'Use the memory manager to inspect loaded memories.';
  });

  if (onAgentSwitch) {
    registry.register('agents', 'Switch agent (usage: /agents <agent-id>)', async (args, _ctx) => {
      const agentId = args[0];
      if (!agentId) return 'Usage: /agents <agent-id>';
      return onAgentSwitch(agentId);
    });
  }

  registry.register('skills', 'List available skills', async (_args, _ctx) => {
    const names = skillRegistry.listNames();
    if (names.length === 0) return 'No skills loaded.';
    const rows = names.map((n: string) => {
      const s = skillRegistry.getByName(n);
      return `${s?.name ?? n} — ${s?.description ?? 'No description'}`;
    });
    return `Skills:\n${rows.join('\n')}`;
  });

  registry.register('skill', 'Get skill content by name (usage: /skill <name>)', async (args, _ctx) => {
    const name = args[0];
    if (!name) return 'Usage: /skill <name>';
    const skill = skillRegistry.getByName(name);
    if (!skill) return `Skill not found: ${name}`;
    return skill.content;
  });

  registry.register('reload-skills', 'Reload all skills', async (_args, _ctx) => {
    skillRegistry.reload();
    return 'Skills reloaded.';
  });

  return registry;
}
