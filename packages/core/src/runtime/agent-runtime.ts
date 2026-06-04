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
import { SessionCompactor } from './session-compactor.js';
import { classifyError, backoffDelay } from './error-classifier.js';
import type { CompactionOptions } from './session-compactor.js';
import type { Skill } from '../skills/index.js';
import {
  getDefaultSystemPrompt,
  buildEffectiveSystemPrompt,
  getUserContext,
  getSystemContext,
} from '../prompt/index.js';

const DEFAULT_TOOL_TIMEOUT = 30_000;
const SHELL_TOOL_TIMEOUT = 120_000;
const DEFAULT_MAX_RETRIES = 2;

/** Convert a basic JSON Schema input definition to a Zod schema for AI SDK tool validation. */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType<unknown> {
  if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
    return z.object({});
  }
  const s = schema as { type?: string; properties?: Record<string, unknown>; required?: string[] };
  const shape: Record<string, z.ZodType<unknown>> = {};
  if (s.properties) {
    for (const [key, prop] of Object.entries(s.properties)) {
      const p = prop as { type?: string; description?: string; optional?: boolean };
      let field: z.ZodType<unknown>;
      switch (p.type) {
        case 'string':  field = z.string().optional(); break;
        case 'number':  field = z.number().optional(); break;
        case 'boolean': field = z.boolean().optional(); break;
        case 'object':  field = jsonSchemaToZod((p as {type?: string; properties?: Record<string, unknown>}).properties ?? {}).optional(); break;
        case 'array':   field = z.array(z.unknown()).optional(); break;
        default:        field = z.unknown().optional();
      }
      shape[key] = field;
    }
  }
  return z.object(shape);
}

export interface AgentRuntimeOptions {
  modelRouter?: ModelRouter;
  toolRegistry: ToolRegistry;
  memoryManager?: MemoryManager;
  approvalEngine: ApprovalEngine;
  maxSteps?: number;
  compaction?: CompactionOptions;
  signal?: AbortSignal;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'approval_request' | 'approval_denied' | 'done' | 'error' | 'spinner_start' | 'spinner_stop';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  error?: string;
  label?: string;
  success?: boolean;
  message?: string;
}

export type StreamHandler = (chunk: StreamChunk) => void;

/**
 * Core agent execution loop.
 * Drives a ReAct-style: model → tool call → approval → execute → repeat.
 *
 * Features:
 * - Session compaction before each run to stay within context budget
 * - Error classification and retry for tool execution
 * - AbortController support for cancellation
 * - Exponential backoff on transient/tool timeout errors
 */
export class AgentRuntime extends EventEmitter {
  private readonly opts: Required<AgentRuntimeOptions> & {
    maxSteps: number;
    compactor: SessionCompactor;
  };

  constructor(opts: AgentRuntimeOptions) {
    super();
    this.opts = {
      modelRouter: opts.modelRouter ?? new ModelRouter(),
      toolRegistry: opts.toolRegistry,
      memoryManager: opts.memoryManager ?? new MemoryManager(),
      approvalEngine: opts.approvalEngine,
      maxSteps: opts.maxSteps ?? 20,
      compaction: opts.compaction ?? {},
      signal: opts.signal as AbortSignal,
      compactor: new SessionCompactor(opts.compaction),
    };
  }

  async run(
    session: Session,
    userMessage: string,
    agentProfile: AgentProfile,
    envContext: EnvContext,
    onChunk: StreamHandler,
  ): Promise<Message[]> {
    // Check abort signal before starting
    if (this.opts.signal?.aborted) {
      onChunk({ type: 'error', error: 'Run aborted before start.' });
      return [];
    }

    // Compact session before run to stay within context budget
    const compacted = this.opts.compactor.compact(session);

    const model = this.opts.modelRouter.resolve(agentProfile.model);

    // Get user context for meta user message (prependUserContext pattern)
    const projectName = envContext.cwd.split('/').pop();
    const userContextArgs: { projectName?: string; sessionStartDate: Date } = {
      sessionStartDate: new Date(),
    };
    if (projectName !== undefined) {
      userContextArgs.projectName = projectName;
    }
    const userContext = await getUserContext(userContextArgs);

    // Get system context for appending to system prompt (appendSystemContext pattern)
    const systemContextArgs: { gitBranch?: string; gitStatus?: string } = {};
    if (envContext.gitBranch !== undefined) {
      systemContextArgs.gitBranch = envContext.gitBranch;
    }
    if (envContext.gitChangedFiles?.length) {
      systemContextArgs.gitStatus = `Changed: ${envContext.gitChangedFiles.join(', ')}`;
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

    // Append system context to the system prompt
    const systemContextLines = Object.entries(systemContext)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
    const systemPromptSuffix = systemContextLines
      ? `\n## System Context\n${systemContextLines}`
      : '';
    const systemPrompt = effectivePrompt.join('\n') + systemPromptSuffix;

    // Convert session messages to AI SDK format
    const history = compacted.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Build tools for AI SDK
    const aiTools: ToolSet = {};

    for (const toolDef of agentTools) {
      const toolDef_ = toolDef;
      const toolTimeout = toolDef_.maxDuration ??
        (toolDef_.name === 'shell' ? SHELL_TOOL_TIMEOUT : DEFAULT_TOOL_TIMEOUT);
      const maxRetries = toolDef_.maxRetries ?? DEFAULT_MAX_RETRIES;

      aiTools[toolDef_.name] = aiTool({
        description: toolDef_.description,
        parameters: jsonSchemaToZod(toolDef_.inputSchema as Record<string, unknown>),
        execute: async (rawInput: unknown): Promise<string> => {
          const input = rawInput as Record<string, unknown>;
          const toolCall = { id: nanoid(), name: toolDef_.name, input };

          // Determine actual risk (shell commands get re-evaluated)
          let riskLevel = toolDef_.riskLevel;
          if (toolDef_.name === 'shell' && typeof input['command'] === 'string') {
            riskLevel = classifyShellRisk(input['command'] as string);
          }

          onChunk({ type: 'tool_call', toolName: toolDef_.name, toolInput: input });
          onChunk({ type: 'spinner_start', label: 'Running tool...' });

          const approved = await this.opts.approvalEngine.check(toolCall, riskLevel);
          if (!approved) {
            onChunk({ type: 'approval_denied', toolName: toolDef_.name });
            return `Tool execution denied by user for: ${toolDef_.name}`;
          }

          onChunk({ type: 'approval_request' });

          // Execute with retry for transient errors
          let lastError: unknown;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              // Run tool with timeout via Promise.race
              const result = await Promise.race([
                toolDef_.execute(input),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error(`Tool ${toolDef_.name} timed out after ${toolTimeout}ms`)), toolTimeout),
                ),
              ]);

              const output = result.success ? result.output : `Error: ${result.error ?? 'unknown'}`;
              onChunk({ type: 'tool_result', toolName: toolDef_.name, toolResult: output });
              onChunk({ type: 'spinner_stop', label: 'Running tool...', success: result.success });

              this.emit('tool:executed', { toolName: toolDef_.name, success: result.success, riskLevel });
              return output;
            } catch (err) {
              lastError = err;
              const category = classifyError(err);

              // Only retry on transient or timeout errors
              if (category === 'permanent' || attempt >= maxRetries) {
                break;
              }

              // Exponential backoff before retry
              const delay = backoffDelay(attempt);
              onChunk({ type: 'spinner_start', label: `Retrying ${toolDef_.name} (attempt ${attempt + 1}/${maxRetries})...` });
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }

          // All retries exhausted or permanent error
          const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
          onChunk({ type: 'tool_result', toolName: toolDef_.name, toolResult: `Error: ${errorMsg}` });
          onChunk({ type: 'spinner_stop', label: 'Running tool...', success: false });

          this.emit('tool:executed', { toolName: toolDef_.name, success: false, riskLevel });
          return `Tool execution failed: ${errorMsg}`;
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
      onChunk({ type: 'spinner_start', label: 'Thinking...' });

      const { textStream, text } = streamText({
        model,
        system: systemPrompt,
        messages: [
          ...history,
          { role: 'user', content: userMessage },
        ],
        ...(Object.keys(aiTools).length > 0 ? { tools: aiTools } : {}),
        maxSteps: this.opts.maxSteps,
        ...(this.opts.signal ? { abortSignal: this.opts.signal } : {}),
      });

      let fullText = '';
      let firstChunk = true;
      for await (const chunk of textStream) {
        // Check abort between chunks
        if (this.opts.signal?.aborted) {
          onChunk({ type: 'error', error: 'Run aborted.' });
          break;
        }
        fullText += chunk;
        onChunk({ type: 'text', content: chunk });
        if (firstChunk) {
          onChunk({ type: 'spinner_stop', label: 'Thinking...', success: true });
          firstChunk = false;
        }
      }

      // Ensure we get the full resolved text (only if not aborted)
      if (!this.opts.signal?.aborted) {
        const resolvedText = await text;
        if (resolvedText && resolvedText !== fullText) {
          fullText = resolvedText;
        }
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
