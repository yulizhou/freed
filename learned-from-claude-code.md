# 问题
- 前台 agent 和后台 agent 是如何转换的？生命周期有区别吗？
- task 任务系统是干嘛的？好像是具体执行命令和工具的？和 agent 的关系是什么？
- Reactive compact 是什么？


# 引擎：主循环和prompt
## 主循环
- 一个while(true)里多个 continue 点，模拟状态机的状态变换
    - 下一轮工具调用
    - reactive compact
    - token 超限恢复
    - stop hook 阻断
    - 模型降级
- tool 执行也是 streaming 的，不等模型输出完毕，只要流式过程中检测到 tool use 就去执行了

## Prompt Design
src/constants/prompts.ts

静态部分
动态部分（按会话状态注入）


# Tools

## Tool pipeline
1.找工具:通过名字或别名(alias)找到对应的Tool对象
2.解析MCP元数据:如果是MCP工具，提取server信息
3.Zod schena校验:用输入schera做第一道校验，挡住乱传参数
4.validateInput():工具自己的细粒度校验
5.Speculative classifer:如果是BashTool,启动一个预测性分类器，在权限决策之前就开始分析命令的风险等级
6.PreToolUse hooks:运行所有注册的pre-hook
7.解析Hook权限结果:Hook可能返回allow、ask、deny，也可能修改输入
8.走权限决策:综合Hook结果、规则配置、用户交互，做出最终允许/拒绝决策
9.修正输入:如果权限决策或Hook修改了输入，用修改后的版本
10.执行tool.call():真正跑工具
11.记录 analytics/tracing/OTel:遥测和可观测性
12. PostToolUse hooks:成功后的 post-hook
13.处理结果:结构化输出、tool_result block构建
14.PostToolUseFailure hooks:如果失败了,跑失败hook

## Tool Pooling
- available tools must be gated before injecting into the pool


## available tools
- built-in tools
    - file tools (read/write/append, list dir, search)
    - grep, ripgrep tools
    - git tools (status, diff, commit, push)
    - web search tools
    - LSP for call hierarchy, code search, doc search, etc.
- gated tools
    - shell execution (with risk classification and approval)
    - MCP tools (defined by external MCP servers, dynamically loaded)
- MCP tools


# Agent 编排

## Agent 调度
- support multiple agents with different profiles and capabilities
- agents can be forked from each other, inheriting memory and context but diverging in their own direction
- agent profiles can specify different models, tools, and behavior patterns (e.g. more creative vs more analytical)

## 调度流程
1. 判断是fork、built-in agent、multi-agent teammate还是 remote
2. 解析输人参数:description、 prompt、 subagent_type、 model、run_in_background、isolation、 cwd
3. 根据权限规则过滤可用的agent
4. 检查 MCP依赖
5. 构造 system prompt 和prompt messages
6. 处理worktree隔离
7. 注册前台/后台任务
8. 调用runAgent()

## Fork
当fork一个agent 时，它会继承主线程的模型、system prompt、完整对话上下文、工具集，尽量保持字节级一致。为什么? 为了让API请求的前缀一样，从而复用主线程的prompt cache。

## 子 agent 流程
1. 初始化agent专属的MCPservers(可以从frontmatter定义)
2. 克隆 file state cache
3. 获取 user/system context
4. 对只读agent做内容瘦身
5. 构造agent专属的权限模式
6. 组装工具池
7. 注册 frontmatter hooks
8. 预加载skills
9. 执行 SubagentStart hooks
10. 调用query()进入主循环
11. 记录 transcript
12. 清理MCP连接、hooks、perfettotracing、todos、shelltasks等


# Permision System
权限不是按钮，是状态机；状态机不是配置项，是系统设计。

## 权限模块分类
- PermissionMode:default、 plan、 auto等模式
- PermissionRule: 基本规则定义(allow/deny/ask)
- PermissionResult:决策结果
- 各种分类器和规则引擎（并行执行）：
    - bashClassifier:Bash命令风险分类
    - yoloClassifier:auto模式下的分类器
    - dangerousPatterns:危险命令模式匹配
    - shellRuleMatching:Shell命令的规则匹配
    - pathValidation:文件路径校验

## Permission Context Management
- maintain a dynamic permission context that tracks which tools have been approved for use in the current session, and under what conditions (e.g. "shell access approved for this session, but only for specific commands")
- the source of rules in the context: user config, project config, CLI params, runtime sessions, etc.

## Guardrail
- do not share personal info in the code or PR messages

## Tool Permission
- filter tools by deny rules before pooling tools for models
- runtime permission check before tool execution
- MAY use a separate agent w/ to decide if a tool call is allowed based on the input and context


# Hook
PreToolUse:工具执行前
PostToolUse:工具执行成功后
PostToolUseFailure:工具执行失败后
Stop

## Hook Permission
hook allow/deny/ask 如何配合权限系统的 allow/deny/ask？


# Slash Command Definitions
built-in slash commands (`/clear`, `/agents`, `/help`)
- `/clear` — clear session history
- `/agents` — list active agents + configs
- '/btw' - ask questions without interrupting the current agent's thought process (background question)
- 'quit' - exit the REPL

# Ecosystem and extentions
## SKILLS
pass

## MCP Servers
pass

## Plugin/Extension market
- markdown commands 和 SKILL.md 目录
- hooks (Pre/PostToolUse)
- output styles
- MCPserver配置
- 模型和 effort hints
- 运行时变量替换(${CLAUDE_PLUGIN_ROOT}等)
- 自动更新、版本管理、blocklist


# Context Strategy
## Dynamic Context Building
- layered: static (global available), project-specific

### build project-specific context
- when git available, read current branch and recent commit messages and code changes to build context

## general strategies
- only include relevant memory entries based on current conversation and tool calls
- automatically truncate long contexts and run autocompaction (/summarization) if needed.
- if tool results do get too large, they are written to disk, and the context only uses a preview plus a file reference
- SKILL 按需注入
- MCP 按连接状态注入
- Memoryprefetch:在模型流式输出的同时，预取可能相关的memory内容
- Skilldiscoveryprefetch:同上,预取可能相关的skill
- Toolresult budget:单个工具结果太大时，持久化到磁盘，只保留摘要在上下文里

### 4 compact processes
1. SnipCompact:把历史消息中过长的部分裁剪掉
2. MicroConpact:更细粒度的压缩,基于tool_use__id做缓存编辑
3. ContextCollapse:把不活跃的上下文区域折叠成摘要
4. Auto Compact:当总token数接近阈值时，触发全量压缩
5. Reactive compact:????

用阈值判断，先做 1、2，没法降到阈值以下就再做 3、4，还不够再做 5


# Memory
## Auto Dream 
后台记忆整理


# Session Management
- support multiple concurrent sessions (e.g. different agents or conversations)
- each session has its own context, memory, and tool usage history
- sessions can be paused, resumed, or forked into new sessions

## structured session memory
save to disk in a structured format (e.g. JSON or SQLite) instead of just appending to a Markdown file, to enable better querying and analysis of past sessions.
- Session Title
- Current State
- Task specification
- Files and Functions
- Workflow
- Errors & Corrections
- Codebase and System Documentation
- Learnings
- Key results
- Worklog




# 技术栈
## CLI rendering 和交互
- React and Ink
- rich colors, spinners, progress bars, tables
- better input handling (slash commands, multiline input, autocompletion)

# KAIROS
提示词：src/constants/prompts.ts:860
- 通过 <tick> 心跳提示保持活跃
- 根据终端焦点状态调整自主程度
- 可以独立 commit、push 和做决策
- 发送主动通知和状态更新
- 监控 GitHub PR 变更




# 其它 feature
- 语音模式：Push to talk

# UI
- show context remaining
- show current model

