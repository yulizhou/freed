import 'dotenv/config';
import { Command } from 'commander';
import process from 'node:process';
import { runApp } from './app.js';

const program = new Command();

program
  .name('freed')
  .description('A terminal-native agentic coding assistant')
  .version('0.1.0');

program
  .command('chat', { isDefault: true })
  .description('Start an interactive chat session (default)')
  .option('-a, --agent <id>', 'Agent ID to use', 'coder')
  .option('-y, --yolo', 'Auto-approve all tool calls (dangerous!)', false)
  .option('-p, --project <dir>', 'Project root directory', process.cwd())
  .action(async (options: { agent: string; yolo: boolean; project: string }) => {
    await runApp({
      agentId: options.agent,
      yolo: options.yolo,
      projectRoot: options.project,
    });
  });

program
  .command('run <prompt>')
  .description('Run a single prompt non-interactively')
  .option('-a, --agent <id>', 'Agent ID to use', 'coder')
  .option('-y, --yolo', 'Auto-approve all tool calls', false)
  .action(async (prompt: string, options: { agent: string; yolo: boolean }) => {
    // For non-interactive run, collect a single response and exit
    const { ToolRegistry, BUILT_IN_TOOLS, collectEnvContext } = await import('@freed/core');
    const { MemoryManager, AgentsLoader } = await import('@freed/core');
    const { ModelRouter } = await import('@freed/core');
    const { AgentRuntime, ApprovalEngine, createSession } = await import('@freed/core');
    const { renderMarkdown, formatError } = await import('./renderer.js');

    const toolRegistry = new ToolRegistry();
    toolRegistry.registerMany(BUILT_IN_TOOLS);
    const memoryManager = new MemoryManager();
    const agentsLoader = new AgentsLoader();
    const modelRouter = new ModelRouter();
    const approvalEngine = new ApprovalEngine(async () => options.yolo);

    const agentProfiles = await agentsLoader.load();
    const agent = agentProfiles.find((a) => a.id === options.agent) ?? agentProfiles[0]!;
    const runtime = new AgentRuntime({ modelRouter, toolRegistry, memoryManager, approvalEngine });
    const envContext = await collectEnvContext();
    const session = createSession(agent);

    let output = '';
    try {
      await runtime.run(session, prompt, agent, envContext, (chunk) => {
        if (chunk.type === 'text') output += chunk.content ?? '';
      });
      console.log(renderMarkdown(output));
    } catch (err) {
      console.error(formatError(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command('memory')
  .description('List or manage memory entries')
  .option('-s, --scope <scope>', 'Memory scope: global | project | session', 'project')
  .action(async (options: { scope: string }) => {
    const { MemoryManager } = await import('@freed/core');
    const manager = new MemoryManager();
    const scope = options.scope as 'global' | 'project' | 'session' | 'agent';
    const entries = await manager.read(scope);
    if (entries.length === 0) {
      console.log(`No ${scope} memories found.`);
      return;
    }
    for (const entry of entries) {
      console.log(`\n[${entry.scope}] ${entry.tags.join(', ')}\n${entry.content}\n`);
    }
  });

program
  .command('doctor')
  .description('Check your Freed setup')
  .action(async () => {
    const { collectEnvContext } = await import('@freed/core');
    const { AgentsLoader } = await import('@freed/core');
    const chalk = (await import('chalk')).default;

    console.log(chalk.bold('\nFreed Doctor\n'));

    const env = await collectEnvContext();
    console.log(`✓ Node.js: ${env.nodeVersion}`);
    console.log(`✓ OS: ${env.os}`);
    console.log(`✓ Shell: ${env.shell}`);

    const hasAnthropicKey = Boolean(process.env['ANTHROPIC_API_KEY']);
    const hasOpenAIKey = Boolean(process.env['OPENAI_API_KEY']);
    const hasGoogleKey = Boolean(process.env['GOOGLE_API_KEY']);
    const hasDeepSeekKey = Boolean(process.env['DEEPSEEK_API_KEY'] ?? process.env['MODEL_KEY']);
    const hasOpenRouterKey = Boolean(process.env['OPENROUTER_API_KEY']);
    console.log(`${hasAnthropicKey ? '✓' : '✗'} ANTHROPIC_API_KEY: ${hasAnthropicKey ? 'set' : 'not set'}`);
    console.log(`${hasOpenAIKey ? '✓' : '✗'} OPENAI_API_KEY: ${hasOpenAIKey ? 'set' : 'not set'}`);
    console.log(`${hasGoogleKey ? '✓' : '✗'} GOOGLE_API_KEY: ${hasGoogleKey ? 'set' : 'not set'}`);
    console.log(`${hasDeepSeekKey ? '✓' : '✗'} DEEPSEEK_API_KEY / MODEL_KEY: ${hasDeepSeekKey ? 'set' : 'not set'}`);
    console.log(`${hasOpenRouterKey ? '✓' : '✗'} OPENROUTER_API_KEY: ${hasOpenRouterKey ? 'set' : 'not set'}`);

    const loader = new AgentsLoader();
    const profiles = await loader.load();
    console.log(`✓ Agents loaded: ${profiles.map((p) => p.id).join(', ')}`);

    if (env.gitBranch) {
      console.log(`✓ Git branch: ${env.gitBranch}`);
    }

    console.log('');
  });

program.parse(process.argv);
