import { streamText, tool as aiTool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import type { AgentProfile, Message, Session, EnvContext } from '@freed/shared';
import { FreedError, ErrorCode } from '@freed/shared';
import { ModelRouter } from '@freed/models';
import { ToolRegistry, classifyShellRisk } from '@freed/tools';
import { MemoryManager } from '@freed/storage';
import { ApprovalEngine } from './approval-engine.js';
import { skillRegistry } from './skill-registry.js';
import type { Skill } from '@freed/skills';

export interface AgentRuntimeOptions {
  modelRouter?: ModelRouter;
  toolRegistry: ToolRegistry;
  memoryManager?: MemoryManager;
  approvalEngine: ApprovalEngine;
  maxSteps?: number;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'approval_request' | 'approval_denied' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  error?: string;
}

export type StreamHandler = (chunk: StreamChunk) => void;

/**
 * Core agent execution loop.
 * Drives a ReAct-style: model → tool call → approval → execute → repeat.
 */
export class AgentRuntime extends EventEmitter {
  private readonly opts: Required<AgentRuntimeOptions> & { maxSteps: number };

  constructor(opts: AgentRuntimeOptions) {
    super();
    this.opts = {
      modelRouter: opts.modelRouter ?? new ModelRouter(),
      toolRegistry: opts.toolRegistry,
      memoryManager: opts.memoryManager ?? new MemoryManager(),
      approvalEngine: opts.approvalEngine,
      maxSteps: opts.maxSteps ?? 20,
    };
  }

  async run(
    session: Session,
    userMessage: string,
    agentProfile: AgentProfile,
    envContext: EnvContext,
    onChunk: StreamHandler,
  ): Promise<Message[]> {
    const model = this.opts.modelRouter.resolve(agentProfile.model);

    // Build system prompt with memory context
    let memorySummary = '';
    try {
      memorySummary = await this.opts.memoryManager.buildContextSummary(['global', 'project']);
    } catch {
      // memory not critical
    }

    // Load skills for project
    let skillsContext = '';
    try {
      const skills = skillRegistry.getForProject(envContext.cwd);
      if (skills.length > 0) {
        console.info(`Loaded ${skills.length} skills for project`);
        skillsContext = skills.map((s: Skill) => s.content).join('\n\n---\n\n');
      }
    } catch {
      // skills not critical
    }

    const systemPrompt = buildSystemPrompt(agentProfile.systemPrompt, envContext, memorySummary, skillsContext);

    // Convert session messages to AI SDK format
    const history = session.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Build tools for AI SDK
    const agentTools = this.opts.toolRegistry.forAgent(agentProfile.tools);
    const aiTools: ToolSet = {};

    for (const toolDef of agentTools) {
      const toolDef_ = toolDef;
      aiTools[toolDef_.name] = aiTool({
        description: toolDef_.description,
        parameters: z.object({}),
        execute: async (rawInput: Record<string, unknown>): Promise<string> => {
          const toolCall = { id: nanoid(), name: toolDef_.name, input: rawInput };

          // Determine actual risk (shell commands get re-evaluated)
          let riskLevel = toolDef_.riskLevel;
          if (toolDef_.name === 'shell' && typeof rawInput['command'] === 'string') {
            riskLevel = classifyShellRisk(rawInput['command'] as string);
          }

          onChunk({ type: 'tool_call', toolName: toolDef_.name, toolInput: rawInput });

          const approved = await this.opts.approvalEngine.check(toolCall, riskLevel);
          if (!approved) {
            onChunk({ type: 'approval_denied', toolName: toolDef_.name });
            return `Tool execution denied by user for: ${toolDef_.name}`;
          }

          onChunk({ type: 'approval_request' });

          const result = await toolDef_.execute(rawInput);
          const output = result.success ? result.output : `Error: ${result.error ?? 'unknown'}`;
          onChunk({ type: 'tool_result', toolName: toolDef_.name, toolResult: output });

          this.emit('tool:executed', { toolName: toolDef_.name, success: result.success, riskLevel });

          return output;
        },
      });
    }

    const messages: Message[] = [];
    const userMsg: Message = {
      id: nanoid(),
      role: 'user',
      content: userMessage,
      createdAt: new Date(),
    };
    messages.push(userMsg);

    try {
      const { textStream, text } = streamText({
        model,
        system: systemPrompt,
        messages: [
          ...history,
          { role: 'user', content: userMessage },
        ],
        ...(Object.keys(aiTools).length > 0 ? { tools: aiTools } : {}),
        maxSteps: this.opts.maxSteps,
      });

      let fullText = '';
      for await (const chunk of textStream) {
        fullText += chunk;
        onChunk({ type: 'text', content: chunk });
      }

      // Ensure we get the full resolved text
      const resolvedText = await text;
      if (resolvedText && resolvedText !== fullText) {
        fullText = resolvedText;
      }

      const assistantMsg: Message = {
        id: nanoid(),
        role: 'assistant',
        content: fullText,
        createdAt: new Date(),
      };
      messages.push(assistantMsg);
      onChunk({ type: 'done' });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      onChunk({ type: 'error', error });
      throw new FreedError(ErrorCode.MODEL_ERROR, `Model call failed: ${error}`, err);
    }

    return messages;
  }
}

function buildSystemPrompt(
  agentSystemPrompt: string,
  env: EnvContext,
  memorySummary: string,
  skillsContext: string,
): string {
  const parts: string[] = [agentSystemPrompt];

  parts.push(`\n## Environment\n- OS: ${env.os}\n- Shell: ${env.shell}\n- CWD: ${env.cwd}\n- Node: ${env.nodeVersion}`);

  if (env.gitBranch) {
    parts.push(`- Git branch: ${env.gitBranch}`);
  }
  if (env.gitChangedFiles && env.gitChangedFiles.length > 0) {
    parts.push(`- Changed files: ${env.gitChangedFiles.join(', ')}`);
  }

  if (memorySummary) {
    parts.push(`\n## Memory\n${memorySummary}`);
  }

  if (skillsContext) {
    parts.push(`\n## Skills\n${skillsContext}`);
  }

  return parts.join('\n');
}
