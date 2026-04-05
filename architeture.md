# Freed Architecture

## Overview

Freed is a terminal-native agentic coding assistant — a CLI tool that runs an interactive ReAct-style agent loop with structured tool calling, approval gates, slash commands, and a dual extension plane (Local Skills + MCP Servers).

---

## Package Structure

```
apps/cli/              # Main CLI entry point, TUI rendering, slash commands
packages/runtime/      # AgentRuntime (ReAct loop), ApprovalEngine, Session, SlashCommands
packages/models/       # ModelRouter (Anthropic, OpenAI, Google, DeepSeek)
packages/tools/        # ToolRegistry, built-in tools, MCP Gateway
packages/skills/       # Local Skill loader and registry
packages/storage/      # MemoryManager (Markdown), AgentsLoader
packages/shared/       # Types, Zod schemas, FreedError, ErrorCode
```

### `apps/cli`

- Entry: `src/bin.ts` → calls `runApp()` from `src/app.ts`
- REPL loop via Node.js `readline` (not Ink/React — plain terminal)
- Slash command registry, environment context collection, session management
- Does NOT own a tool registry — receives one constructed here with built-in tools only (MCP tools loaded from `@freed/tools`)

### `packages/runtime`

- **AgentRuntime**: ReAct loop — builds system prompt, calls AI SDK `streamText`, routes tool calls through `ApprovalEngine`, executes tools, collects results
- **ApprovalEngine**: Risk-scoring and user-confirmation gate for medium/ask risk tools
- **Session / Messages**: `createSession`, `appendMessages`, `trimSession`
- **SlashCommandRegistry**: Built-in commands (`/clear`, `/agents`, `/help`) + extensibility

### `packages/models`

- **ModelRouter**: Resolves model strings (`anthropic/claude-sonnet-4-6`) to AI SDK provider instances
- Supports: Anthropic, OpenAI, Google, DeepSeek, OpenRouter

### `packages/tools`

Core exports (`index.ts`):
- `toolRegistry` — `ToolRegistry` singleton pre-loaded with built-in tools
- `BUILT_IN_TOOLS` — `readFileTool`, `writeFileTool`, `listDirTool`, `shellTool`, `gitStatusTool`, `gitDiffTool`, `gitLogTool`
- `MCPGateway` — loads MCP servers, exposes tools to registry
- `collectEnvContext` — gathers OS, shell, CWD, Node version, Git branch/status

**Built-in tools** (`src/`):
- `file-tools.ts`: `readFileTool`, `writeFileTool`, `listDirTool`
- `shell-tool.ts`: `shellTool` + `classifyShellRisk` (marks `rm -rf`, `git reset --hard` as `ask`)
- `git-tools.ts`: `gitStatusTool`, `gitDiffTool`, `gitLogTool`
- `tool-registry.ts`: `ToolRegistry` — `register`, `registerMany`, `get`, `has`, `list`, `forAgent`
- `env-context.ts`: `collectEnvContext`

**MCP extension** (`src/mcp/`):
- `types.ts`: `MCPServerConfig` (Zod), `MCPConfig` schemas
- `config-loader.ts`: `loadMCPConfig(projectDir?)` — loads and merges `~/.freed/mcp/servers.json` (global) + `.freed/mcp/servers.json` (project, overrides by server name)
- `server-impl.ts`: `StdioMCPServer` (`StdioClientTransport`) + `HttpMCPServer` (`StreamableHTTPClientTransport`) behind `MCPServerHandle` interface
- `tool-adapter.ts`: `adaptMCPTool(serverName, tool, client)` → `AnyToolDefinition` with `mcp__<server>__<name>` prefixed name
- `mcp-gateway.ts`: `MCPGateway` — orchestrates server lifecycle, per-server error isolation, aggregates all tools
- `doctor.ts`: `checkMCPServers(projectDir?)` — health-check each configured server

**Test files** (`src/__tests__/`):
- `mcp-config.test.ts`, `mcp-tool-adapter.test.ts` (both pass)

### `packages/skills`

- `SkillLoader`: Scans `~/.freed/skills/`, `~/.claude/skills/`, `.freed/skills/` for `SKILL.md` files
- `SkillRegistry`: Registers skills by scope (system/user/project), provides `getForProject(cwd)`
- Skill format: Markdown with YAML frontmatter (`name`, `description`)

### `packages/storage`

- **MemoryManager**: Reads/writes Markdown memory files with frontmatter (`scope`, `tags`, `updated_at`, `confidence`), builds context summaries for the agent
- **AgentsLoader**: Loads `agents.md` (global `~/.freed/agents/`, project `.freed/agents/`)

### `packages/shared`

All shared types: `ToolDescriptor`, `ToolCall`, `ToolResult`, `RiskLevel` (`safe | ask | deny`), `Message`, `Session`, `AgentProfile`, `MemoryEntry`, `EnvContext`, `FreedError`, `ErrorCode`. Schemas via Zod.

---

## Data Flow

```
User input
    │
    ▼
app.ts: REPL loop
    │ "/slash" command → SlashCommandRegistry
    │ plain text → AgentRuntime.run()
    ▼
AgentRuntime
    ├─ builds system prompt (agent profile + env context + memory + skills)
    ├─ streamText(model, messages, { tools })
    │       │
    │       ▼ model returns tool call
    ├─ ApprovalEngine.check(toolCall, riskLevel)
    │       ├─ riskLevel = tool.riskLevel (or classifyShellRisk for shell)
    │       └─ ask → prompt user confirmation
    ├─ toolRegistry.get(name) → ToolDefinition.execute(input)
    │       ├─ built-in tools (file, shell, git)
    │       └─ MCP tools (mcp__server__tool) via MCPGateway
    ├─ MCPGateway → @modelcontextprotocol/sdk Client
    │       ├─ StdioMCPServer → StdioClientTransport → subprocess
    │       └─ HttpMCPServer → StreamableHTTPClientTransport → HTTP/SSE
    ├─ result appended to messages
    └─ repeat until done
```

---

## Tool Registry Namespace

| Namespace | Prefix | Source |
|-----------|--------|--------|
| Built-in | (no prefix) | `file-tools`, `shell-tool`, `git-tools` |
| MCP | `mcp__<server>__` | `@modelcontextprotocol/sdk` servers |

Example: MCP tool `read` from server `filesystem` → `mcp__filesystem__read`

---

## MCP Server Configuration

Config file format (`servers.json`):

```json
{
  "servers": [
    { "name": "filesystem", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"] },
    { "name": "github", "url": "https://api.github.com/mcp", "headers": { "Authorization": "Bearer ..." } }
  ]
}
```

Config locations:
- **Global**: `~/.freed/mcp/servers.json`
- **Project**: `.freed/mcp/servers.json` (merges with global; project-level servers with the same `name` override global ones)

Loaded by `MCPGateway.loadGlobal()` at startup and `MCPGateway.loadProject(cwd)` when a session starts.

---

## Approval Engine

Risk levels:
- **`safe`**: auto-approved
- **`ask`**: user confirmation prompt before execution
- **`deny`**: auto-rejected

Shell commands are re-evaluated at execution time via `classifyShellRisk`:
- `rm -rf`, `git reset --hard` → `ask`
- All others → `safe` (unless the tool itself is marked `ask`)

---

## Local Skills

Skill directories scanned at startup:
- `~/.freed/skills/` (system, highest priority)
- `~/.claude/skills/` (user)
- `.freed/skills/` (project, lowest priority)

Each skill is a `SKILL.md` file with frontmatter:
```yaml
---
name: demo
description: A demo skill
---
# Skill body (Markdown, provided to the agent as context)
```

Skills are aggregated into the system prompt under `## Skills` by `AgentRuntime`.

---

## CLI Command Structure

```
freed                    # Interactive REPL session
freed run "<prompt>"     # (planned) single-shot run
freed daemon start|stop  # (planned) background daemon
freed agent list|use     # (planned) agent management
freed memory             # (planned) memory management
freed doctor             # MCP server health check
```

---

## Error Handling

All errors wrapped in `FreedError` with typed `ErrorCode`:
- `TOOL_NOT_FOUND`, `TOOL_EXECUTION_FAILED`, `APPROVAL_DENIED`
- `MODEL_ERROR`, `MEMORY_READ_ERROR`, `MEMORY_WRITE_ERROR`
- `CONFIG_INVALID`, `AGENT_NOT_FOUND`

---

## Dependencies

**AI/Model SDKs**: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`
**MCP**: `@modelcontextprotocol/sdk`
**CLI**: `commander`, `chalk`, `marked`, `marked-terminal`
**Storage**: `gray-matter`
**Process**: `execa`, `eventemitter3`, `nanoid`, `zod`
**Dev**: `vitest`, `typescript`, `tsup`
