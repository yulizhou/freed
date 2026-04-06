# Freed Architecture

## Overview

Freed is a terminal-native agentic coding assistant — a CLI tool that runs an interactive ReAct-style agent loop with structured tool calling, approval gates, slash commands, and a dual extension plane (Local Skills + MCP Servers).

---

## Package Structure

Freed uses a **two-package architecture**:

```
apps/cli/              # @freed/cli — The CLI application (entry point, TUI, slash commands)
packages/core/         # @freed/core — The engine: AgentRuntime, tools, skills, storage, shared
```

### `@freed/cli` (apps/cli/)

- Entry: `src/bin.ts` → calls `runApp()` from `src/app.ts`
- REPL loop via Node.js `readline` (not Ink/React — plain terminal)
- Multi-line input: `Shift+Enter` adds a new line, plain `Enter` submits; `Ctrl+C` in multi-line mode clears the buffer without exiting
- Spinner support via `SpinnerManager` (ora): shows during tool execution and AI warm-up, 300ms grace period prevents flicker
- Slash command registry, environment context collection, session management
- Imports from `@freed/core` only — does not own tool registry or agent logic

### `@freed/core` (packages/core/)

- **AgentRuntime**: ReAct loop — builds system prompt, calls AI SDK `streamText`, routes tool calls through `ApprovalEngine`, executes tools, collects results
- **ApprovalEngine**: Risk-scoring and user-confirmation gate for medium/ask risk tools
- **Session / Messages**: `createSession`, `appendMessages`, `trimSession`
- **SlashCommandRegistry**: Built-in commands (`/clear`, `/agents`, `/help`, `/quit`, `/exit`, `/review`, `/bug`, `/tools`, `/memory`, `/skills`, `/skill`, `/reload-skills`) + extensibility
- **ModelRouter**: Resolves model strings (`anthropic/claude-sonnet-4-6`) to AI SDK provider instances. Supports: Anthropic, OpenAI, Google, DeepSeek, OpenRouter
- **ToolRegistry**: `ToolRegistry` singleton pre-loaded with built-in tools (`readFileTool`, `writeFileTool`, `listDirTool`, `shellTool`, `gitStatusTool`, `gitDiffTool`, `gitLogTool`) + MCP Gateway
- **MCPGateway**: loads MCP servers, exposes tools to registry
- **SkillLoader + SkillRegistry**: Scans for `SKILL.md` files in `~/.freed/skills/`, `~/.claude/skills/`, `.freed/skills/`
- **MemoryManager**: Reads/writes Markdown memory files with frontmatter
- **Shared types**: `ToolDescriptor`, `ToolCall`, `ToolResult`, `RiskLevel`, `Message`, `Session`, `AgentProfile`, `FreedError`, `ErrorCode`, `StreamChunk`

### Design Rationale

**Two packages, not seven.** Each package is independently installable and publishable:

| Package | What it is | Who uses it |
|---------|-----------|------------|
| `@freed/core` | The engine — usable as a library in other Node.js projects | Developers building CLI tools |
| `@freed/cli` | The terminal app — the end-user experience | End users |

**Why not more packages?** Separating `runtime`, `models`, `tools`, `skills`, `storage`, `shared` into individual packages creates maintenance overhead (7x API surfaces, 7x release workflows) without meaningful benefit for a solo developer or typical users. The module boundaries remain clear and importable from `@freed/core` if needed.

---

## Data Flow

```
User input
    │
    ▼
app.ts: REPL loop
    │ "/slash" command → SlashCommandRegistry
    │ plain text → AgentRuntime.run()
    │ spinner events (spinner_start/spinner_stop) → SpinnerManager → terminal
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

## Future Work: Rust Core Refactoring

The two-package architecture is designed to enable a future Rust-based engine without disrupting the CLI or users.

### The Goal

Replace the performance-critical parts of `@freed/core` (ReAct loop, tool execution) with a Rust implementation, while keeping `@freed/cli` unchanged and maintaining API compatibility.

### Why It's Feasible

The clean boundary between `@freed/cli` and `@freed/core` means the Rust refactor is an *internal implementation detail* of `@freed/core`. As long as `@freed/core`'s public interface stays the same, the CLI (and any downstream consumers) don't need to change.

### Three Realistic Refactoring Paths

| Approach | How it works | Trade-off |
|----------|-------------|-----------|
| **Rust binary + stdio bridge** | Rust subprocess, JSON over stdio | Stable, low latency, simple |
| **Rust core + HTTP daemon** | Local HTTP/gRPC service called by TypeScript | Adds latency, needs lifecycle management |
| **Rust → WebAssembly** | Compile Rust to WASM, load in Node.js | Harder WASM interop, ecosystem still maturing |

### What Makes It Easy

- The package boundary (`@freed/core` interface) is already clean
- AgentRuntime, ToolRegistry, ApprovalEngine are well-isolated
- No changes needed to `@freed/cli` or user-facing behavior

### What Makes It Hard

- **The interface boundary itself** — the internal message protocol between components becomes a critical API you can't break once Rust is in the picture
- **Debugging culture** — Rust panics vs. JS stack traces
- **Iteration speed** — TypeScript's fast HMR vs. Rust compile times
- **Tooling shift** — vitest → Rust's test frameworks, tsup → Cargo

### Prerequisite

Before attempting a Rust refactor: define and document a **stable internal interface** (the message protocol between the ReAct loop and tool executor). Treat it like a public API. Once that's locked down, swapping the engine behind it is a clean rewrite.

### References

- Roadmap item: *"Architecture decoupling: high-performance Rust engine + TypeScript agentic logic via gRPC/HTTP"*

---

## Dependencies

**AI/Model SDKs**: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`
**MCP**: `@modelcontextprotocol/sdk`
**CLI**: `commander`, `chalk`, `marked`, `marked-terminal`, `ora`
**Storage**: `gray-matter`
**Process**: `execa`, `eventemitter3`, `nanoid`, `zod`
**Dev**: `vitest`, `typescript`, `tsup`
