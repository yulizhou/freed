import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import type { AgentProfile } from '@freed/core';
import { loadSkillsFromDir } from '@freed/core';
import { skillRegistry } from '@freed/core';
import { ToolRegistry, BUILT_IN_TOOLS, collectEnvContext } from '@freed/core';
import { MemoryManager, AgentsLoader } from '@freed/core';
import { ModelRouter } from '@freed/core';
import {
  AgentRuntime,
  ApprovalEngine,
  createSession,
  appendMessages,
  createBuiltinCommands,
} from '@freed/core';
import type { StreamChunk } from '@freed/core';
import { askConfirmation } from './prompt.js';
import {
  renderMarkdown,
  formatUserMessage,
  formatAssistantPrefix,
  formatToolCall,
  formatToolResult,
  formatApprovalRequest,
  formatError,
  formatInfo,
  formatSuccess,
} from './renderer.js';
import chalk from 'chalk';
import readline from 'node:readline';

export interface AppOptions {
  projectRoot?: string;
  agentId?: string;
  yolo?: boolean; // auto-approve all
}

/**
 * Main CLI application loop.
 */
export async function runApp(opts: AppOptions = {}): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();

  // ── Setup ──────────────────────────────────────────────────────────────────
  console.log(chalk.bold.green('\n  Freed  ') + chalk.dim('— your terminal coding assistant\n'));
  console.log(chalk.dim('  Type your message and press Enter. /help for commands. Ctrl+C to exit.\n'));

  // ── Load skills from ~/.freed/skills and ~/.claude/skills ───────────────────
  /**
   * Manual test:
   * 1. Create ~/.freed/skills/demo/SKILL.md with:
   *    ---
   *    name: demo
   *    description: A demo skill
   *    ---
   *    # Demo Skill
   *    This is the skill body.
   * 2. Run the CLI
   * 3. /skills should list "demo"
   * 4. /skill demo should show the full content
   * 5. Edit ~/.freed/skills/demo/SKILL.md
   * 6. /reload-skills → /skill demo should show updated content
   *
   * Error handling:
   * - Missing skill root directories → silently skipped (no error)
   * - loadSkillsFromDir throws (e.g., permission error) → WARN logged, CLI continues
   * - Parse errors in SKILL.md → thrown from loader, caught here as WARN
   * - Files >1MB → WARN logged by loader, file skipped
   */
  try {
    const homeDir = os.homedir();
    const systemSkills = await loadSkillsFromDir(
      path.join(homeDir, '.freed/skills'),
      'system',
    ).catch(() => []);
    const userSkills = await loadSkillsFromDir(
      path.join(homeDir, '.claude/skills'),
      'user',
    ).catch(() => []);
    // Project skills are loaded lazily via /reload-skills; count as 0 at startup
    const projectSkills: typeof systemSkills = [];

    const systemCount = systemSkills.length;
    const userCount = userSkills.length;
    const projectCount = projectSkills.length;
    const total = systemCount + userCount + projectCount;

    if (systemSkills.length > 0) {
      skillRegistry.register('system', systemSkills, path.join(homeDir, '.freed/skills'));
    }
    if (userSkills.length > 0) {
      skillRegistry.register('user', userSkills, path.join(homeDir, '.claude/skills'));
    }

    if (total > 0) {
      console.info(`Loaded ${total} skills (system: ${systemCount}, user: ${userCount}, project: ${projectCount})`);
    } else {
      console.info('No skills found');
    }
  } catch (err) {
    console.warn('Failed to load skills:', err instanceof Error ? err.message : err);
  }

  const toolRegistry = new ToolRegistry();
  toolRegistry.registerMany(BUILT_IN_TOOLS);

  const memoryManager = new MemoryManager({ projectDir: `${projectRoot}/.freed/memory/project` });
  const agentsLoader = new AgentsLoader(projectRoot);
  const modelRouter = new ModelRouter();

  const approvalEngine = new ApprovalEngine(async (toolCall, riskLevel) => {
    if (opts.yolo) return true;
    const input = toolCall.input as Record<string, unknown>;
    console.log(formatApprovalRequest(toolCall.name, input));
    return askConfirmation(`Allow ${toolCall.name} (risk: ${riskLevel})?`);
  });

  const agentProfiles = await agentsLoader.load();
  let currentAgentId = opts.agentId ?? 'coder';
  let currentAgent: AgentProfile =
    agentProfiles.find((a) => a.id === currentAgentId) ?? agentProfiles[0]!;

  const runtime = new AgentRuntime({
    modelRouter,
    toolRegistry,
    memoryManager,
    approvalEngine,
  });

  let envContext = await collectEnvContext(projectRoot);
  let session = createSession(currentAgent);

  // ── Slash Commands ─────────────────────────────────────────────────────────
  const slashCommands = createBuiltinCommands(
    () => {
      session = createSession(currentAgent);
      console.log(formatSuccess('Session cleared.'));
    },
    async (agentId) => {
      const found = agentProfiles.find((a) => a.id === agentId);
      if (!found) {
        const available = agentProfiles.map((a) => a.id).join(', ');
        return `Agent "${agentId}" not found. Available: ${available}`;
      }
      currentAgent = found;
      currentAgentId = agentId;
      session = createSession(currentAgent);
      return `Switched to agent: ${currentAgent.name} (${currentAgent.model})`;
    },
  );

  // Register /help
  slashCommands.register('help', 'Show available commands', async () => {
    const cmds = slashCommands.list();
    const lines = cmds.map((c) => `  /${c.name.padEnd(12)} ${c.description}`);
    return `Available commands:\n${lines.join('\n')}`;
  });

  // ── Input loop ─────────────────────────────────────────────────────────────
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const askLine = (): Promise<string | null> =>
    new Promise((resolve) => {
      process.stdout.write(chalk.cyan('\n> '));
      rl.once('line', resolve);
      rl.once('close', () => resolve(null));
    });

  rl.on('SIGINT', () => {
    console.log(chalk.dim('\n\nGoodbye!\n'));
    process.exit(0);
  });

  console.log(formatInfo(`Agent: ${currentAgent.name} | Model: ${currentAgent.model}`));
  if (envContext.gitBranch) {
    console.log(formatInfo(`Git: ${envContext.gitBranch}`));
  }
  console.log('');

  // Main REPL loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const input = await askLine();

    if (input === null) {
      break; // EOF / Ctrl+D
    }

    const trimmed = input.trim();
    if (!trimmed) continue;

    // Handle slash commands
    if (trimmed.startsWith('/')) {
      const [cmd, ...args] = trimmed.slice(1).split(/\s+/);
      if (!cmd) continue;

      const result = await slashCommands.execute(cmd, args, {
        session,
        agentProfile: currentAgent,
        envContext,
      });
      console.log('\n' + result + '\n');
      continue;
    }

    // Refresh env context on each turn (git status may change)
    try {
      envContext = await collectEnvContext(projectRoot);
    } catch {
      // non-critical
    }

    console.log('\n' + formatUserMessage(trimmed));
    process.stdout.write('\n' + formatAssistantPrefix());

    let pendingApprovalInput: unknown = null;
    let pendingApprovalTool: string | null = null;

    const onChunk = (chunk: StreamChunk): void => {
      switch (chunk.type) {
        case 'text':
          process.stdout.write(chunk.content ?? '');
          break;

        case 'tool_call':
          pendingApprovalTool = chunk.toolName ?? null;
          pendingApprovalInput = chunk.toolInput;
          process.stdout.write('\n' + formatToolCall(chunk.toolName ?? '', chunk.toolInput));
          break;

        case 'tool_result':
          process.stdout.write(
            formatToolResult(chunk.toolName ?? '', chunk.toolResult ?? '') + '\n',
          );
          break;

        case 'approval_denied':
          process.stdout.write(formatError(`Tool ${chunk.toolName} was denied.\n`));
          break;

        case 'done':
          process.stdout.write('\n');
          break;

        case 'error':
          process.stdout.write('\n' + formatError(chunk.error ?? 'Unknown error') + '\n');
          break;

        default:
          break;
      }
      // suppress unused warning
      void pendingApprovalInput;
      void pendingApprovalTool;
    };

    try {
      const newMessages = await runtime.run(
        session,
        trimmed,
        currentAgent,
        envContext,
        onChunk,
      );
      session = appendMessages(session, newMessages);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('\n' + formatError(message));
    }
  }

  rl.close();
  console.log(chalk.dim('\nGoodbye!\n'));
}
