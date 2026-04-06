# Freed
The Auditable, High-Performance CLI Agent for Modern Developers.

Freed is more than just a terminal chatbot or another CLI tool just like CC or Codex. It is a digital collaborator designed with transparent and sense of control at its core. Freed is also aiming to  easily integrate into your existing development workflow and switch between work scenarios. 

---

# 📅 Roadmap
## 1. CLI & UI (Interface)

- [x] Interactive REPL: Conversational loop driven by Node.js readline.
- [x] Markdown & Code Rendering: Terminal rendering with ANSI colors and syntax highlighting.
- [x] Slash Commands: Built-in commands like /clear, /agents, and /help.
- [ ] TUI Visualization: Real-time dashboard for Agent state machines and tool-call tracing.
- [ ] Interaction Enhancements: Support for multi-line input and terminal spinners for long-running tasks.

## 2. Agent Core & Logic
- [x] ReAct Execution Loop: Model → Tool Call → Approval → Execute → Repeat cycle.
- [x] Multi-Model Routing: Architecture complete (dynamic switching logic in progress).
- [x] Environment Awareness: Automated collection of OS, Shell, Git status, and runtime versions.
- [ ] Scenario Switching: Dynamically swap skill sets and agents based on context (e.g., Coding vs. Office).
- [ ] Smart Orchestrator: Optimized logic to decide between pre-defined workflows or autonomous agent skills.

## 3. Skill & Extension System (Tools)
- [x] Local Skill Loading: Support for .md skill definitions with YAML frontmatter.
- [x] Native MCP Support: Full integration with Stdio and HTTP/SSE Model Context Protocol servers.
- [x] Core Toolset: Built-in tools for file I/O, Shell execution (with risk grading), and Git operations.
- [ ] Remote Extensions: Install skills and plugins directly from GitHub links.
- [ ] Server Mode: Expose Freed as a background service via HTTP/gRPC APIs.

## 4. Memory & Context Management
- [x] Layered Markdown Storage: Hierarchical memory isolation (Global, Project, Session, Agent).
- [x] Context Summarization: Automatic generation of background knowledge for system prompts.
- [ ] Layered Compact Strategy: Advanced context compression to optimize token usage.
- [ ] Auto Dream: Structured session memory archiving and extraction for long-term recall.
- [ ] Pre-flight Token Estimation: Predictive cost analysis and automatic model routing.

## 5. Security & Auditability
- [x] Risk Classification: Dynamic assessment of shell commands (Safe/Ask/Deny).
- [x] Approval Engine: Human-in-the-loop confirmation for sensitive operations.
- [ ] Decision Traceability (Git Notes): Use Git Notes to link every commit to its AI decision context.
- [ ] Token Budgeting: Safety breakers to prevent unexpected API costs.

## 6. Architecture & Performance
- [x] Two-package architecture: `@freed/core` (engine) + `@freed/cli` (app)
- [ ] Rust core refactoring: Replace the ReAct loop and tool execution engine with a Rust implementation for better performance, while keeping the TypeScript layer unchanged. See [architeture.md](./architeture.md) for the three refactoring paths.
- [ ] Performance Telemetry: Instrumentation for evaluation and execution efficiency analysis.

## 7. Layered Prompt Architecture
- [x] Definition Layer: Section registry with memoization and cache semantics.
- [x] Assembly Layer: Priority-based prompt composition (override > agent > custom > default).
- [x] Context Injection: Dual-channel injection (userContext as meta message, systemContext as prompt append).
- [x] Attachment Layer: Per-turn dynamic info via `system-reminder` protocol.
- [x] Transport Layer: API block splitting with `cacheScope` metadata.
- [x] Skill Templates: Parameterized skill prompts with argument substitution.

## Model Providers

Freed uses the Vercel AI SDK to support multiple model providers. Configure your API keys in a `.env` file in the project root.

### Supported Providers

| Provider | Model Prefix | Env Variable |
|----------|-------------|--------------|
| Anthropic | `anthropic/` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai/` | `OPENAI_API_KEY` |
| Google AI | `google/` | `GOOGLE_API_KEY` |
| DeepSeek | `deepseek/` | `DEEPSEEK_API_KEY` or `MODEL_KEY` |
| OpenRouter | `openrouter/` | `OPENROUTER_API_KEY` |

### Example `.env` File

```bash
# At least one API key is required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
```

### Use as a Library

`@freed/core` is designed to be usable as a building block for your own CLI tools:

```typescript
import { AgentRuntime, ToolRegistry } from '@freed/core'

const runtime = new AgentRuntime({ model: 'anthropic/claude-sonnet-4-6' })
const result = await runtime.run('Your prompt here')
```

See [architeture.md](./architeture.md) for the full module breakdown.

# Build and Run

## Prerequisites

- **Node.js**: v22.0.0 or higher
- **pnpm**: v9.0.0 or higher

## Installation

```bash
# Install dependencies
pnpm install
```

## Build

```bash
# Build all packages
pnpm build
```

## Run

After building, link the CLI globally so you can run `freed` from anywhere:

```bash
# Link the CLI globally
pnpm --filter @freed/cli link
```

Now you can run `freed` from any terminal:

```bash
freed
```

## Development

```bash
# Run CLI in development mode (live reload)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Clean build artifacts
pnpm clean
```

# Licensing
Distributed under the [MIT License](https://www.google.com/search?q=LICENSE).
