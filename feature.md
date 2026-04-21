# Freed 功能清单 / Feature Checklist

> ✅ = 已实现 | 🔜 = 规划中 | ⬜ = 未开始

---

## 1. CLI 交互与入口模块 (CLI & UI)

| 功能 | 状态 | 说明 |
|------|------|------|
| 对话式终端 REPL | ✅ | `apps/cli/src/app.ts` — Node.js `readline` 驱动的交互式循环 |
| Markdown 渲染 | ✅ | `marked` + `marked-terminal` |
| 代码高亮 | ✅ | `chalk` ANSI 色彩渲染 |
| Approval 确认流 | ✅ | `ApprovalEngine` — `safe` 自动通过，`ask` 阻断确认，`deny` 自动拒绝 |
| Slash Commands | ✅ | `SlashCommandRegistry` + 内置 `/clear`、`/agents`、`/help` |
| TUI 可视化仪表盘 | ⬜ | — |
| 多行输入 | ✅ | `apps/cli/src/app.ts` — `Shift+Enter` 添加新行，`Enter` 提交；`Ctrl+C` 清空当前输入 |
| 进度提示 Spinner | ✅ | `apps/cli/src/renderer.ts` — `SpinnerManager`（`ora`）；工具执行和 AI 思考期间显示 spinner，300ms 宽限期防闪烁 |
| 工具进程信息显隐 | ✅ | `apps/cli/src/app.ts` — `Ctrl+O` 切换 spinner 显示/隐藏，默认隐藏 |

---

## 2. Agent 与模型引擎模块 (Agent & LLM Engine)

| 功能 | 状态 | 说明 |
|------|------|------|
| ReAct 执行循环 | ✅ | `AgentRuntime.run()` — model → tool call → approval → execute → repeat |
| 多模型切换 | 🔜 | `ModelRouter` 架构已搭好，动态切换尚未完成 |
| AI SDK 集成 | ✅ | `streamText` from `ai` package |
| 本地 `agents.md` 配置 | ✅ | `AgentsLoader` — 全局 `~/.freed/agents/` + 项目级 `.freed/agents/` |
| 多 Agent 协作 | ⬜ | — |
| 动态环境感知 | ✅ | `collectEnvContext` — OS / Shell / CWD / Node & Bun 版本 / Git branch & status |
| Structured Tool Calling | ✅ | AI SDK 原生 tool 调用协议 |
| 场景切换（Scenario Switching） | ⬜ | — |
| 智能编排器（Smart Orchestrator） | ⬜ | — |

---

## 3. 技能与扩展系统 (Skill & Tools System)

| 功能 | 状态 | 说明 |
|------|------|------|
| 本地 Skill 挂载 | ✅ | `SkillLoader` + `SkillRegistry` — 扫描 `~/.freed/skills/`、`~/.claude/skills/`、`.freed/skills/` |
| Skill 格式 | ✅ | `SKILL.md`（YAML frontmatter + Markdown body） |
| MCP 协议集成（Phase 1） | ✅ | `MCPGateway` + `StdioMCPServer` + `HttpMCPServer` |
| MCP Stdio 传输 | ✅ | `@modelcontextprotocol/sdk` `StdioClientTransport` |
| MCP HTTP/SSE 传输 | ✅ | `@modelcontextprotocol/sdk` `StreamableHTTPClientTransport` |
| MCP 工具命名空间 | ✅ | `mcp__<server>__<tool>` 前缀隔离 |
| MCP 全局配置 | ✅ | `~/.freed/mcp/servers.json` |
| MCP 项目配置 | ✅ | `.freed/mcp/servers.json`（合并 + 按 name 覆盖） |
| MCP Doctor 健康检查 | ✅ | `checkMCPServers()` — 逐 server 连接测试 |
| 核心工具集（文件 I/O、Shell、Git） | ✅ | 内置工具已完成 |
| 远程扩展（从 GitHub 安装） | ⬜ | — |
| Server Mode（HTTP/gRPC APIs） | ⬜ | — |

**已注册的内置工具：**

| 工具 | 风险等级 | 说明 |
|------|----------|------|
| `readFile` | `safe` | 文件读取 |
| `writeFile` | `ask` | 文件写入（穿過 ApprovalEngine） |
| `listDir` | `safe` | 目录列表 |
| `shell` | `safe` → `ask` | Shell 执行（`classifyShellRisk` 动态评估） |
| `gitStatus` | `safe` | Git 状态 |
| `gitDiff` | `safe` | Git diff |
| `gitLog` | `safe` | Git log |
| `mcp__*` | `ask` | MCP 工具（通过 MCPGateway 动态加载） |

---

## 4. 后台守护进程模块 (Daemon Engine)

| 功能 | 状态 | 说明 |
|------|------|------|
| 独立 Daemon 服务 | ⬜ | — |
| File Watcher 触发器 | ⬜ | — |
| 持久化任务队列 | ⬜ | — |
| IPC 通信（CLI ↔ Daemon） | ⬜ | — |

---

## 5. 本地化记忆与状态管理 (Memory & Context Management)

| 功能 | 状态 | 说明 |
|------|------|------|
| 多层级记忆隔离 | ✅ | `scope: global / project / session / agent` |
| Markdown 记忆存储 | ✅ | `MemoryManager` — 读写 Markdown 文件（gray-matter frontmatter） |
| 记忆上下文摘要 | ✅ | `MemoryManager.buildContextSummary()` — 注入 system prompt |
| 项目级 Memory | ✅ | `.freed/memory/project/` |
| 全局 Memory | ✅ | `~/.freed/memory/global/` |
| 层级压缩策略（Layered Compact） | ⬜ | — |
| Auto Dream（梦境记忆归档） | ⬜ | — |
| Pre-flight Token 估算 | ⬜ | — |
| SQLite 运行时状态 | ⬜ | —（规划中用于任务队列、事件索引） |

---

## 6. 安全与审计 (Security & Audit)

| 功能 | 状态 | 说明 |
|------|------|------|
| 命令风险分级 | ✅ | `classifyShellRisk` — `safe / ask / deny` |
| 审批确认 | ✅ | `ApprovalEngine` — 阻断式 `Y/n` 确认 |
| 审计日志 | ⬜ | — |
| 决策可追溯（Git Notes） | ⬜ | — |
| Token 预算控制 | ⬜ | — |
| 工具超时 | ⬜ | — |
| 输出截断 | ⬜ | — |

---

## 7. 架构与性能 (Architecture & Performance)

| 功能 | 状态 | 说明 |
|------|------|------|
| 架构解耦（Rust 引擎 + TypeScript Agent 层） | ⬜ | — |
| 性能遥测（Performance Telemetry） | ⬜ | — |

---

## 8. 分层 Prompt 架构 (Prompt Architecture)

> 基于 `prompt-architecture.md` 参考设计实现的 5 层 prompt 运行时。

| 层级 | 状态 | 说明 |
|------|------|------|
| **Definition Layer** - `packages/prompt/src/sections/` | ✅ | Base intro/system/tone, env, tools, memory, language, skills |
| **Assembly Layer** - `packages/prompt/src/assemble/` | ✅ | `getDefaultSystemPrompt()` + `buildEffectiveSystemPrompt()` 优先级组装 |
| **Context Injection Layer** - `packages/prompt/src/context/` | ✅ | `getUserContext()` + `getSystemContext()` 双通道注入 |
| **Attachment Layer** - `packages/prompt/src/attachments/` | ✅ | `system-reminder` 协议 per-turn 动态附件 |
| **Transport Layer** - `packages/prompt/src/transport/` | ✅ | `splitSysPromptPrefix()` API block + cacheScope |
| **Section Registry** - `packages/prompt/src/sectionRegistry.ts` | ✅ | `PromptSection` + memoization + cacheBreak 语义 |
| **PromptTemplate (Skill)** - `packages/skills/src/skill.ts` | ✅ | `SkillTemplate.getPromptForCommand()` 参数化 skill 模板 |
| `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` 缓存分隔标记 | ✅ | 静态/动态 section 分离，支持 global cache |
| 优先级覆盖 (override > agent > custom > default) | ✅ | `buildEffectiveSystemPrompt()` |

**核心文件：**
```
packages/prompt/src/
  types.ts              # PromptSection, SystemPrompt, PromptBlock, PromptAttachment
  sectionRegistry.ts     # systemPromptSection() / uncachedSystemPromptSection() + memoization
  sections/
    base.ts             # 身份、Tone & Style、输出效率 section
    env.ts              # EnvContext 格式化
    tools.ts            # ToolDescriptor 列表（带风险标签）
    memory.ts           # MemoryManager 集成
    language.ts         # 语言/作用域设置
    skills.ts           # Skill 调用说明
  assemble/
    getDefaultSystemPrompt.ts  # 构建默认 system prompt（string[] + boundary marker）
    buildEffectiveSystemPrompt.ts # 优先级覆盖组装
  context/
    getUserContext.ts   # UserContext（注入为 meta user message）
    getSystemContext.ts  # SystemContext（追加到 system prompt）
  attachments/
    createSystemReminder.ts    # wrapInSystemReminder()
    injectDynamicAttachments.ts # skill_discovery / mcp_delta / relevant_memories
  transport/
    splitSystemPromptBlocks.ts # 按 cacheScope 切分 API blocks
```

---

## 已实现的核心文件

```
apps/cli/src/
  bin.ts              # CLI 入口
  app.ts              # runApp() — REPL 循环

packages/
  core/src/runtime/
    agent-runtime.ts  # ReAct 执行循环
    approval-engine.ts # 审批引擎
    session.ts        # Session 管理
    slash-commands.ts # Slash 命令注册

  core/src/models/
    model-router.ts   # 多模型路由（架构完成，切换逻辑未实现）

  core/src/tools/
    tool-registry.ts  # 工具注册表
    file-tools.ts      # 文件读写工具
    shell-tool.ts      # Shell 执行工具（含风险分类）
    git-tools.ts      # Git 工具
    env-context.ts     # 环境信息收集
    mcp/
      types.ts         # MCPServerConfig / MCPConfig Zod schemas
      config-loader.ts # 加载 + 合并 global/project 配置
      server-impl.ts   # StdioMCPServer + HttpMCPServer
      tool-adapter.ts  # MCP 工具 → mcp__<server>__<name>
      mcp-gateway.ts   # MCP 网关（生命周期管理）
      doctor.ts        # MCP 健康检查
    __tests__/
      mcp-config.test.ts
      mcp-tool-adapter.test.ts

  core/src/skills/
    skill-loader.ts    # 扫描 Skill 目录
    skill-registry.ts   # Skill 注册表

  core/src/storage/
    memory-manager.ts   # Markdown 记忆读写
    agents-loader.ts    # agents.md 加载

  core/src/shared/
    types.ts            # 所有共享类型 + Zod schemas + FreedError
```

---

## MCP 配置示例

```json
// ~/.freed/mcp/servers.json  或  .freed/mcp/servers.json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    {
      "name": "github",
      "url": "https://api.github.com/mcp",
      "headers": { "Authorization": "Bearer ghp_xxxx" }
    }
  ]
}
```

加载后工具名为 `mcp__filesystem__read`、`mcp__github__create_issue` 等。
