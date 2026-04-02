import { z } from 'zod';

// ─── Risk Level ───────────────────────────────────────────────────────────────

export const RiskLevelSchema = z.enum(['safe', 'ask', 'deny']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// ─── Tool ─────────────────────────────────────────────────────────────────────

export const ToolInputSchema = z.record(z.unknown());
export type ToolInput = z.infer<typeof ToolInputSchema>;

export const ToolResultSchema = z.object({
  success: z.boolean(),
  output: z.string(),
  error: z.string().optional(),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

export const ToolDescriptorSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
  riskLevel: RiskLevelSchema,
});
export type ToolDescriptor = z.infer<typeof ToolDescriptorSchema>;

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: ToolInputSchema,
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

// ─── Message ──────────────────────────────────────────────────────────────────

export const MessageRoleSchema = z.enum(['user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  toolCall: ToolCallSchema.optional(),
  toolResult: ToolResultSchema.optional(),
  createdAt: z.date(),
});
export type Message = z.infer<typeof MessageSchema>;

// ─── Session ──────────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  messages: z.array(MessageSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Session = z.infer<typeof SessionSchema>;

// ─── Agent Profile ────────────────────────────────────────────────────────────

export const AgentProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.string(),
  systemPrompt: z.string(),
  tools: z.array(z.string()),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
});
export type AgentProfile = z.infer<typeof AgentProfileSchema>;

// ─── Memory Entry ─────────────────────────────────────────────────────────────

export const MemoryScopeSchema = z.enum(['global', 'project', 'session', 'agent']);
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

export const MemoryEntrySchema = z.object({
  id: z.string(),
  scope: MemoryScopeSchema,
  content: z.string(),
  tags: z.array(z.string()),
  updatedAt: z.date(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

// ─── Events ───────────────────────────────────────────────────────────────────

export const TaskEventSchema = z.object({
  type: z.enum([
    'task.created',
    'task.started',
    'task.completed',
    'task.failed',
    'artifact.generated',
    'approval.requested',
    'approval.granted',
    'approval.denied',
  ]),
  taskId: z.string(),
  payload: z.unknown().optional(),
  timestamp: z.date(),
});
export type TaskEvent = z.infer<typeof TaskEventSchema>;

// ─── Config ───────────────────────────────────────────────────────────────────

export const FreedConfigSchema = z.object({
  defaultAgent: z.string().default('coder'),
  models: z
    .object({
      openai: z
        .object({
          apiKey: z.string().optional(),
          baseUrl: z.string().optional(),
        })
        .optional(),
      anthropic: z
        .object({
          apiKey: z.string().optional(),
        })
        .optional(),
      google: z
        .object({
          apiKey: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});
export type FreedConfig = z.infer<typeof FreedConfigSchema>;

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const ErrorCode = {
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  APPROVAL_DENIED: 'APPROVAL_DENIED',
  MODEL_ERROR: 'MODEL_ERROR',
  MEMORY_READ_ERROR: 'MEMORY_READ_ERROR',
  MEMORY_WRITE_ERROR: 'MEMORY_WRITE_ERROR',
  CONFIG_INVALID: 'CONFIG_INVALID',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class FreedError extends Error {
  public readonly code: ErrorCode;
  public override readonly cause: unknown;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'FreedError';
    this.code = code;
    this.cause = cause;
  }
}

// ─── Environment Context ──────────────────────────────────────────────────────

export const EnvContextSchema = z.object({
  os: z.string(),
  shell: z.string(),
  cwd: z.string(),
  nodeVersion: z.string(),
  bunVersion: z.string().optional(),
  gitBranch: z.string().optional(),
  gitStatus: z.string().optional(),
  gitChangedFiles: z.array(z.string()).optional(),
});
export type EnvContext = z.infer<typeof EnvContextSchema>;

// ─── Slash Command ────────────────────────────────────────────────────────────

export const SlashCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  args: z.array(z.string()).optional(),
});
export type SlashCommand = z.infer<typeof SlashCommandSchema>;
