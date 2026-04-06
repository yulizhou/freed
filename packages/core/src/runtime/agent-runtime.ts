import { streamText, tool as aiTool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import type { AgentProfile, Message, Session, EnvContext } from '../shared/index.js';
import { FreedError, ErrorCode } from '../shared/index.js';
import { ModelRouter } from '../models/index.js';
import { ToolRegistry, classifyShellRisk } from '../tools/index.js';
import { MemoryManager } from '../storage/index.js';
import { ApprovalEngine } from './approval-engine.js';
import { skillRegistry } from './skill-registry.js';
import type { Skill } from '../skills/index.js';
import {
  getDefaultSystemPrompt,
  buildEffectiveSystemPrompt,
  getUserContext,
  getSystemContext,
} from '../prompt/index.js';

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

    // Get user context for meta user message (prependUserContext pattern)
    const projectName = envContext.cwd.split('/').pop()
    const userContextArgs: { projectName?: string; sessionStartDate: Date } = {
      sessionStartDate: new Date(),
    }
    if (projectName !== undefined) {
      userContextArgs.projectName = projectName
    }
    const userContext = await getUserContext(userContextArgs);

    // Get system context for appending to system prompt (appendSystemContext pattern)
    const systemContextArgs: { gitBranch?: string; gitStatus?: string } = {}
    if (envContext.gitBranch !== undefined) {
      systemContextArgs.gitBranch = envContext.gitBranch
    }
    if (envContext.gitChangedFiles?.length) {
      systemContextArgs.gitStatus = `Changed: ${envContext.gitChangedFiles.join(', ')}`
    }
    const systemContext = getSystemContext(systemContextArgs);

    // Get tools for the agent
    const agentTools = this.opts.toolRegistry.forAgent(agentProfile.tools);

    // Load skills for project
    let skills: Skill[] = [];
    try {
      skills = skillRegistry.getForProject(envContext.cwd);
      if (skills.length > 0) {
        console.info(`Loaded ${skills.length} skills for project`);
      }
    } catch {
      // skills not critical
    }

    // Build default system prompt using the layered assemble layer
    const defaultSystemPrompt = await getDefaultSystemPrompt({
      tools: agentTools,
      env: envContext,
      skills,
      getMemorySummary: async () => {
        try {
          return await this.opts.memoryManager.buildContextSummary(['global', 'project']);
        } catch {
          return '';
        }
      },
    });

    // Apply priority-based effective prompt logic
    const effectivePrompt = buildEffectiveSystemPrompt({
      mainThreadAgentDefinition: agentProfile,
      defaultSystemPrompt,
    });

    // Apply priority-based effective prompt logic (already string[])
    // Append system context to the system prompt
    const systemContextLines = Object.entries(systemContext)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
    const systemPromptSuffix = systemContextLines
      ? `\n## System Context\n${systemContextLines}`
      : '';
    const systemPrompt = effectivePrompt.join('\n') + systemPromptSuffix;

    // Convert session messages to AI SDK format
    const history = session.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Build tools for AI SDK
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
