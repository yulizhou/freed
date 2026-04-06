// Re-exports from shared types
export type {
  RiskLevel,
  ToolInput,
  ToolResult,
  ToolDescriptor,
  ToolCall,
  MessageRole,
  Message,
  Session,
  AgentProfile,
  MemoryScope,
  MemoryEntry,
  TaskEvent,
  FreedConfig,
  ErrorCode,
  EnvContext,
  SlashCommand,
} from './shared/index.js';
export { RiskLevelSchema, ToolInputSchema, ToolResultSchema, ToolDescriptorSchema, ToolCallSchema, MessageRoleSchema, MessageSchema, SessionSchema, AgentProfileSchema, MemoryScopeSchema, MemoryEntrySchema, TaskEventSchema, FreedConfigSchema, EnvContextSchema, SlashCommandSchema, FreedError } from './shared/index.js';

// Re-exports from models
export { ModelRouter } from './models/model-router.js';
export type { ModelRouterOptions } from './models/model-router.js';

// Re-exports from tools
export { ToolRegistry } from './tools/tool-registry.js';
export type { ToolDefinition, AnyToolDefinition } from './tools/types.js';
export { readFileTool, writeFileTool, listDirTool } from './tools/file-tools.js';
export { shellTool, classifyShellRisk } from './tools/shell-tool.js';
export { gitStatusTool, gitDiffTool, gitLogTool } from './tools/git-tools.js';
export { collectEnvContext } from './tools/env-context.js';
export { MCPGateway } from './tools/mcp-gateway.js';
export { BUILT_IN_TOOLS, toolRegistry, mcpGateway } from './tools/index.js';

// Re-exports from storage
export { MemoryManager } from './storage/index.js';
export type { MemoryManagerOptions, MemoryFile } from './storage/index.js';
export { AgentsLoader } from './storage/index.js';

// Re-exports from skills
export { Skill, Scope } from './skills/index.js';
export { SkillRegistry } from './skills/index.js';
export { loadSkillsFromDir } from './skills/index.js';

// Re-exports from prompt
export type { PromptSection, SystemPrompt, EffectiveSystemPrompt } from './prompt/types.js';
export { getDefaultSystemPrompt, buildEffectiveSystemPrompt } from './prompt/assemble/index.js';
export { getUserContext, getSystemContext } from './prompt/context/index.js';

// Re-exports from runtime subdirectory
export { AgentRuntime } from './runtime/agent-runtime.js';
export type { AgentRuntimeOptions, StreamChunk, StreamHandler } from './runtime/agent-runtime.js';
export { ApprovalEngine, autoApprove, autoDeny } from './runtime/approval-engine.js';
export type { ApprovalHandler } from './runtime/approval-engine.js';
export { createSession, appendMessages, trimSession } from './runtime/session.js';
export { SlashCommandRegistry, createBuiltinCommands } from './runtime/slash-commands.js';
export type { SlashCommandHandler, SlashCommandContext } from './runtime/slash-commands.js';
export { skillRegistry } from './runtime/skill-registry.js';
