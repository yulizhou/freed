# Prompt Management Architecture

## 1. 文档目的

本文档总结本仓库的 prompt management architecture，目标是为后续迁移到其他项目提供一个可复用的设计抽象，而不是逐字复制现有文案。

这里关注的是四个问题：

1. prompt 在哪里定义。
2. prompt 如何按运行时条件组装。
3. prompt 之外的上下文如何注入到消息流。
4. 最终如何适配到底层模型 API 与缓存体系。

结论先行：这套架构不是“一个 system prompt 模板文件”，而是一个由多层组件组成的 prompt runtime。它把 system prompt、上下文、附件、技能模板、agent 覆盖和 API 缓存拆成独立层次，从而使 prompt 能够扩展、缓存、分叉和增量更新。

## 2. 总体设计结论

这套架构可以概括为五层：

1. Definition Layer
	 负责定义基础 prompt section 和文案片段。
2. Assembly Layer
	 负责根据运行模式、agent、CLI 参数和 feature flag 组装最终的 system prompt。
3. Context Injection Layer
	 负责把 userContext、systemContext、memory、技能发现等信息注入模型上下文。
4. Attachment Layer
	 负责把动态、增量、按轮变化的说明以 meta message 形式注入，而不是持续重写 system prompt。
5. Transport Layer
	 负责把 system prompt block 化，并附加缓存控制策略后发送给模型 API。

如果要迁到另一个项目，最值得保留的是这个分层边界，而不是具体 prompt 文案。

## 3. 核心架构视图

### 3.1 定义层：system prompt 不是单字符串，而是分块数组

最关键的设计决定是：system prompt 在内部表示为字符串数组，而不是单个长字符串。这样后续才能做静态/动态切分、API block 化、fork prompt 继承和缓存控制。

源码摘录，来自 src/constants/prompts.ts：

```ts
/**
 * Boundary marker separating static (cross-org cacheable) content from dynamic content.
 * Everything BEFORE this marker in the system prompt array can use scope: 'global'.
 * Everything AFTER contains user/session-specific content and should not be cached.
 *
 * WARNING: Do not remove or reorder this marker without updating cache logic in:
 * - src/utils/api.ts (splitSysPromptPrefix)
 * - src/services/api/claude.ts (buildSystemPromptBlocks)
 */
export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY =
	'__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'
```

这段代码揭示了架构里的第一个硬约束：prompt 的组织方式直接服务于缓存策略。也就是说，这里并不是先写 prompt，再“顺便”做缓存，而是从一开始就把 prompt 当作缓存友好的结构化数据来设计。

### 3.2 Section registry：动态 section 被显式建模

动态部分不是直接字符串拼接，而是先进入一个 section registry，再统一解析。每个 section 都可以声明自己是否允许缓存。

源码摘录，来自 src/constants/systemPromptSections.ts：

```ts
type ComputeFn = () => string | null | Promise<string | null>

type SystemPromptSection = {
	name: string
	compute: ComputeFn
	cacheBreak: boolean
}

/**
 * Create a memoized system prompt section.
 * Computed once, cached until /clear or /compact.
 */
export function systemPromptSection(
	name: string,
	compute: ComputeFn,
): SystemPromptSection {
	return { name, compute, cacheBreak: false }
}

/**
 * Create a volatile system prompt section that recomputes every turn.
 * This WILL break the prompt cache when the value changes.
 * Requires a reason explaining why cache-breaking is necessary.
 */
export function DANGEROUS_uncachedSystemPromptSection(
	name: string,
	compute: ComputeFn,
	_reason: string,
): SystemPromptSection {
	return { name, compute, cacheBreak: true }
}

/**
 * Resolve all system prompt sections, returning prompt strings.
 */
export async function resolveSystemPromptSections(
	sections: SystemPromptSection[],
): Promise<(string | null)[]> {
	const cache = getSystemPromptSectionCache()

	return Promise.all(
		sections.map(async s => {
			if (!s.cacheBreak && cache.has(s.name)) {
				return cache.get(s.name) ?? null
			}
			const value = await s.compute()
			setSystemPromptSectionCacheEntry(s.name, value)
			return value
		}),
	)
}
```

这个抽象非常适合迁移，因为它天然支持：

- 某些 section 常驻缓存。
- 某些 section 每轮重算。
- 每个 section 单独命名，方便调试与观测。
- 在不改变主装配逻辑的情况下增删 section。

### 3.3 主 system prompt 组装器：静态前缀 + 动态 section

主装配器位于 src/constants/prompts.ts。它先构建静态部分，再通过 boundary marker 插入动态部分。

源码摘录，来自 src/constants/prompts.ts：

```ts
export async function getSystemPrompt(
	tools: Tools,
	model: string,
	additionalWorkingDirectories?: string[],
	mcpClients?: MCPServerConnection[],
): Promise<string[]> {
	if (isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)) {
		return [
			`You are Claude Code, Anthropic's official CLI for Claude.\n\nCWD: ${getCwd()}\nDate: ${getSessionStartDate()}`,
		]
	}

	const cwd = getCwd()
	const [skillToolCommands, outputStyleConfig, envInfo] = await Promise.all([
		getSkillToolCommands(cwd),
		getOutputStyleConfig(),
		computeSimpleEnvInfo(model, additionalWorkingDirectories),
	])

	const settings = getInitialSettings()
	const enabledTools = new Set(tools.map(_ => _.name))

	if (
		(feature('PROACTIVE') || feature('KAIROS')) &&
		proactiveModule?.isProactiveActive()
	) {
		logForDebugging(`[SystemPrompt] path=simple-proactive`)
		return [
			`\nYou are an autonomous agent. Use the available tools to do useful work.

${CYBER_RISK_INSTRUCTION}`,
			getSystemRemindersSection(),
			await loadMemoryPrompt(),
			envInfo,
			getLanguageSection(settings.language),
			isMcpInstructionsDeltaEnabled()
				? null
				: getMcpInstructionsSection(mcpClients),
			getScratchpadInstructions(),
			getFunctionResultClearingSection(model),
			SUMMARIZE_TOOL_RESULTS_SECTION,
			getProactiveSection(),
		].filter(s => s !== null)
	}

	const dynamicSections = [
		systemPromptSection('session_guidance', () =>
			getSessionSpecificGuidanceSection(enabledTools, skillToolCommands),
		),
		systemPromptSection('memory', () => loadMemoryPrompt()),
		systemPromptSection('ant_model_override', () =>
			getAntModelOverrideSection(),
		),
		systemPromptSection('env_info_simple', () =>
			computeSimpleEnvInfo(model, additionalWorkingDirectories),
		),
		systemPromptSection('language', () =>
			getLanguageSection(settings.language),
		),
		systemPromptSection('output_style', () =>
			getOutputStyleSection(outputStyleConfig),
		),
		DANGEROUS_uncachedSystemPromptSection(
			'mcp_instructions',
			() =>
				isMcpInstructionsDeltaEnabled()
					? null
					: getMcpInstructionsSection(mcpClients),
			'MCP servers connect/disconnect between turns',
		),
		systemPromptSection('scratchpad', () => getScratchpadInstructions()),
		systemPromptSection('frc', () => getFunctionResultClearingSection(model)),
		systemPromptSection(
			'summarize_tool_results',
			() => SUMMARIZE_TOOL_RESULTS_SECTION,
		),
	]

	const resolvedDynamicSections =
		await resolveSystemPromptSections(dynamicSections)

	return [
		getSimpleIntroSection(outputStyleConfig),
		getSimpleSystemSection(),
		outputStyleConfig === null ||
		outputStyleConfig.keepCodingInstructions === true
			? getSimpleDoingTasksSection()
			: null,
		getActionsSection(),
		getUsingYourToolsSection(enabledTools),
		getSimpleToneAndStyleSection(),
		getOutputEfficiencySection(),
		...(shouldUseGlobalCacheScope() ? [SYSTEM_PROMPT_DYNAMIC_BOUNDARY] : []),
		...resolvedDynamicSections,
	].filter(s => s !== null)
}
```

这段代码说明主 prompt 组装器的职责不是“生产一段文案”，而是：

- 判断当前所处模式。
- 决定哪些 section 进入静态区，哪些进入动态区。
- 决定哪些 section 可以缓存，哪些会打破缓存。
- 把工具集合、语言设置、memory、scratchpad、MCP 指令等统一抽象成 section。

## 4. 组装层：prompt 覆盖优先级是显式规则，不是隐式拼接

另一个值得迁移的设计是：默认 prompt、agent prompt、custom prompt、append prompt 有清晰的优先级，而不是在各处随手拼接。

源码摘录，来自 src/utils/systemPrompt.ts：

```ts
/**
 * Builds the effective system prompt array based on priority:
 * 0. Override system prompt (if set, e.g., via loop mode - REPLACES all other prompts)
 * 1. Coordinator system prompt (if coordinator mode is active)
 * 2. Agent system prompt (if mainThreadAgentDefinition is set)
 *    - In proactive mode: agent prompt is APPENDED to default (agent adds domain
 *      instructions on top of the autonomous agent prompt, like teammates do)
 *    - Otherwise: agent prompt REPLACES default
 * 3. Custom system prompt (if specified via --system-prompt)
 * 4. Default system prompt (the standard Claude Code prompt)
 *
 * Plus appendSystemPrompt is always added at the end if specified (except when override is set).
 */
export function buildEffectiveSystemPrompt({
	mainThreadAgentDefinition,
	toolUseContext,
	customSystemPrompt,
	defaultSystemPrompt,
	appendSystemPrompt,
	overrideSystemPrompt,
}: {
	mainThreadAgentDefinition: AgentDefinition | undefined
	toolUseContext: Pick<ToolUseContext, 'options'>
	customSystemPrompt: string | undefined
	defaultSystemPrompt: string[]
	appendSystemPrompt: string | undefined
	overrideSystemPrompt?: string | null
}): SystemPrompt {
	if (overrideSystemPrompt) {
		return asSystemPrompt([overrideSystemPrompt])
	}

	if (
		feature('COORDINATOR_MODE') &&
		isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE) &&
		!mainThreadAgentDefinition
	) {
		const { getCoordinatorSystemPrompt } =
			require('../coordinator/coordinatorMode.js') as typeof import('../coordinator/coordinatorMode.js')
		return asSystemPrompt([
			getCoordinatorSystemPrompt(),
			...(appendSystemPrompt ? [appendSystemPrompt] : []),
		])
	}

	const agentSystemPrompt = mainThreadAgentDefinition
		? isBuiltInAgent(mainThreadAgentDefinition)
			? mainThreadAgentDefinition.getSystemPrompt({
					toolUseContext: { options: toolUseContext.options },
				})
			: mainThreadAgentDefinition.getSystemPrompt()
		: undefined

	if (
		agentSystemPrompt &&
		(feature('PROACTIVE') || feature('KAIROS')) &&
		isProactiveActive_SAFE_TO_CALL_ANYWHERE()
	) {
		return asSystemPrompt([
			...defaultSystemPrompt,
			`\n# Custom Agent Instructions\n${agentSystemPrompt}`,
			...(appendSystemPrompt ? [appendSystemPrompt] : []),
		])
	}

	return asSystemPrompt([
		...(agentSystemPrompt
			? [agentSystemPrompt]
			: customSystemPrompt
				? [customSystemPrompt]
				: defaultSystemPrompt),
		...(appendSystemPrompt ? [appendSystemPrompt] : []),
	])
}
```

这意味着迁移时应保留一个独立的 PromptAssembler，而不要把优先级散落在 CLI、agent runner、SDK entrypoint 等多个位置。

## 5. 上下文注入层：system prompt 之外还有 userContext 和 systemContext

本仓库没有把所有信息都堆进 system prompt，而是刻意保留了三类输入：

1. systemPrompt
2. userContext
3. systemContext

源码摘录，来自 src/utils/queryContext.ts：

```ts
/**
 * Fetch the three context pieces that form the API cache-key prefix:
 * systemPrompt parts, userContext, systemContext.
 *
 * When customSystemPrompt is set, the default getSystemPrompt build and
 * getSystemContext are skipped — the custom prompt replaces the default
 * entirely, and systemContext would be appended to a default that isn't
 * being used.
 */
export async function fetchSystemPromptParts({
	tools,
	mainLoopModel,
	additionalWorkingDirectories,
	mcpClients,
	customSystemPrompt,
}: {
	tools: Tools
	mainLoopModel: string
	additionalWorkingDirectories: string[]
	mcpClients: MCPServerConnection[]
	customSystemPrompt: string | undefined
}): Promise<{
	defaultSystemPrompt: string[]
	userContext: { [k: string]: string }
	systemContext: { [k: string]: string }
}> {
	const [defaultSystemPrompt, userContext, systemContext] = await Promise.all([
		customSystemPrompt !== undefined
			? Promise.resolve([])
			: getSystemPrompt(
					tools,
					mainLoopModel,
					additionalWorkingDirectories,
					mcpClients,
				),
		getUserContext(),
		customSystemPrompt !== undefined ? Promise.resolve({}) : getSystemContext(),
	])
```

这个三分结构非常重要：

- systemPrompt 放稳定的行为规则。
- systemContext 放系统侧的附加上下文，比如 git 状态、cache breaker。
- userContext 放更接近用户工作区和长期指令的内容，比如 CLAUDE.md 和日期。

然后，systemContext 和 userContext 分别走不同注入路径。

源码摘录，来自 src/utils/api.ts：

```ts
export function appendSystemContext(
	systemPrompt: SystemPrompt,
	context: { [k: string]: string },
): string[] {
	return [
		...systemPrompt,
		Object.entries(context)
			.map(([key, value]) => `${key}: ${value}`)
			.join('\n'),
	].filter(Boolean)
}

export function prependUserContext(
	messages: Message[],
	context: { [k: string]: string },
): Message[] {
	if (process.env.NODE_ENV === 'test') {
		return messages
	}

	if (Object.entries(context).length === 0) {
		return messages
	}

	return [
		createUserMessage({
			content: `<system-reminder>\nAs you answer the user's questions, you can use the following context:\n${Object.entries(
				context,
			)
				.map(([key, value]) => `# ${key}\n${value}`)
				.join('\n')}

			IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.\n</system-reminder>\n`,
			isMeta: true,
```

这是一个非常值得复用的设计：同样是“上下文”，但 systemContext 作为 system prompt 尾部扩展，userContext 则作为 meta user message 注入。这保留了不同来源信息的语义边界。

## 6. Attachment 层：很多 prompt 信息根本不属于 system prompt

本仓库有一个强烈的架构倾向：对于按轮变化、增量变化或只在当前 turn 相关的信息，不去重建 system prompt，而是转成 system-reminder 风格的附件消息。

### 6.1 system-reminder 是统一封装协议

源码摘录，来自 src/utils/messages.ts：

```ts
export function wrapInSystemReminder(content: string): string {
	return `<system-reminder>\n${content}\n</system-reminder>`
}

export function wrapMessagesInSystemReminder(
	messages: UserMessage[],
): UserMessage[] {
	return messages.map(msg => {
		if (typeof msg.message.content === 'string') {
			return {
				...msg,
				message: {
					...msg.message,
					content: wrapInSystemReminder(msg.message.content),
				},
			}
		} else if (Array.isArray(msg.message.content)) {
			const wrappedContent = msg.message.content.map(block => {
				if (block.type === 'text') {
					return {
						...block,
						text: wrapInSystemReminder(block.text),
					}
```

这说明附件层不是临时方案，而是一种统一的注入协议。凡是通过附件进入模型的重要系统信息，最终都要被包装为 system-reminder。

### 6.2 技能发现是附件，而不是 system prompt 常驻部分

源码摘录，来自 src/utils/messages.ts：

```ts
if (feature('EXPERIMENTAL_SKILL_SEARCH')) {
	if (attachment.type === 'skill_discovery') {
		if (attachment.skills.length === 0) return []
		const lines = attachment.skills.map(s => `- ${s.name}: ${s.description}`)
		return wrapMessagesInSystemReminder([
			createUserMessage({
				content:
					`Skills relevant to your task:\n\n${lines.join('\n')}\n\n` +
					`These skills encode project-specific conventions. ` +
					`Invoke via Skill("<name>") for complete instructions.`,
				isMeta: true,
			}),
		])
```

这段实现反映出一个关键原则：

- 稳定规则进 system prompt。
- 针对当前输入动态发现出来的辅助信息，用附件进入消息流。

这样可以显著降低 system prompt 抖动，减少缓存失效，同时又保留足够强的引导能力。

## 7. Transport 层：system prompt 会再次被切分成 API blocks

当 prompt 到达 API 适配层时，系统还会再做一次结构化处理，把 system prompt 数组切分成具备不同 cacheScope 的 block。

源码摘录，来自 src/utils/api.ts：

```ts
/**
 * Split system prompt blocks by content type for API matching and cache control.
 *
 * Behavior depends on feature flags and options:
 *
 * 1. MCP tools present (skipGlobalCacheForSystemPrompt=true):
 *    Returns up to 3 blocks with org-level caching (no global cache on system prompt):
 *    - Attribution header (cacheScope=null)
 *    - System prompt prefix (cacheScope='org')
 *    - Everything else concatenated (cacheScope='org')
 *
 * 2. Global cache mode with boundary marker (1P only, boundary found):
 *    Returns up to 4 blocks:
 *    - Attribution header (cacheScope=null)
 *    - System prompt prefix (cacheScope=null)
 *    - Static content before boundary (cacheScope='global')
 *    - Dynamic content after boundary (cacheScope=null)
 */
export function splitSysPromptPrefix(
	systemPrompt: SystemPrompt,
	options?: { skipGlobalCacheForSystemPrompt?: boolean },
): SystemPromptBlock[] {
	const useGlobalCacheFeature = shouldUseGlobalCacheScope()

	if (useGlobalCacheFeature) {
		const boundaryIndex = systemPrompt.findIndex(
			s => s === SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
		)
		if (boundaryIndex !== -1) {
			let attributionHeader: string | undefined
			let systemPromptPrefix: string | undefined
			const staticBlocks: string[] = []
			const dynamicBlocks: string[] = []

			for (let i = 0; i < systemPrompt.length; i++) {
				const block = systemPrompt[i]
				if (!block || block === SYSTEM_PROMPT_DYNAMIC_BOUNDARY) continue

				if (block.startsWith('x-anthropic-billing-header')) {
					attributionHeader = block
				} else if (CLI_SYSPROMPT_PREFIXES.has(block)) {
					systemPromptPrefix = block
				} else if (i < boundaryIndex) {
					staticBlocks.push(block)
				} else {
					dynamicBlocks.push(block)
				}
			}
```

这里的重点不是具体 cacheScope 名字，而是这个设计抽象：PromptTransportAdapter 在发送前才把 prompt 组织成“API 需要的缓存块”。

换句话说，prompt 组装层和 API 传输层是分开的。这个边界在重构时应该保留。

## 8. Skill 层：skill 本质上是参数化 prompt 模板

这个仓库里的 skill 不是简单命令别名，而是具备参数替换、变量替换和安全边界的 prompt template。

源码摘录，来自 src/skills/loadSkillsDir.ts：

```ts
async getPromptForCommand(args, toolUseContext) {
	let finalContent = baseDir
		? `Base directory for this skill: ${baseDir}\n\n${markdownContent}`
		: markdownContent

	finalContent = substituteArguments(
		finalContent,
		args,
		true,
		argumentNames,
	)

	if (baseDir) {
		const skillDir =
			process.platform === 'win32' ? baseDir.replace(/\\/g, '/') : baseDir
		finalContent = finalContent.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir)
	}

	finalContent = finalContent.replace(
		/\$\{CLAUDE_SESSION_ID\}/g,
		getSessionId(),
	)

	if (loadedFrom !== 'mcp') {
		finalContent = await executeShellCommandsInPrompt(
			finalContent,
			{
				...toolUseContext,
				getAppState() {
					const appState = toolUseContext.getAppState()
					return {
						...appState,
						toolPermissionContext: {
							...appState.toolPermissionContext,
							alwaysAllowRules: {
								...appState.toolPermissionContext.alwaysAllowRules,
								command: allowedTools,
							},
						},
					}
				},
			},
			`/${skillName}`,
			shell,
		)
	}
```

这个实现说明 skill 在本系统中的角色更接近 PromptTemplateProvider：

- 它可以带参数。
- 它可以带运行时变量。
- 它可以有本地技能和远程技能两种安全模型。
- 最终产物仍然是 prompt 内容，而不是独立协议。

如果迁到新项目，建议把 skill 抽象成模板层，而不是 CLI 分发层。

## 9. 一次请求的完整调用链

基于以上代码，可以把一次主线程请求抽象为下面的流程：

1. 入口层获取 tools、model、MCP clients、working directories。
2. 调用 getSystemPrompt 生成默认 system prompt section 数组。
3. 调用 getUserContext 和 getSystemContext，生成两类上下文。
4. 调用 buildEffectiveSystemPrompt，根据 agent、override、custom、append 规则生成最终 system prompt。
5. 通过 appendSystemContext 把 systemContext 放进 system prompt 尾部。
6. 通过 prependUserContext 把 userContext 作为 meta user message 注入消息数组前部。
7. 在查询过程中按需附加 attachment，例如 skill discovery、relevant memories、MCP instruction delta。
8. 发送给模型前，通过 splitSysPromptPrefix 把 system prompt 转成带缓存语义的 API blocks。

这条链路最有价值的地方在于：系统把“行为规则”“工作区上下文”“瞬时提醒”“技能模板”“缓存语义”区分成了不同生命周期的对象，而不是把所有东西都堆进一个 prompt 字符串。

## 10. 可迁移设计建议

如果你要把这套架构迁到另一个项目，我建议保留下面这些抽象，而不是照搬 Anthropic 特定功能。

### 10.1 应保留的抽象

1. PromptSection
	 用于声明可缓存与不可缓存的 prompt 片段。

2. PromptAssembler
	 用于处理 default、agent、custom、append、override 的优先级。

3. PromptContextProvider
	 分开提供 systemContext 和 userContext。

4. PromptAttachmentInjector
	 让按轮变化的信息走 system-reminder message，而不是持续重写 system prompt。

5. PromptTransportAdapter
	 在最后一层才把 prompt 转成模型 API 的具体 block 结构。

6. PromptTemplateEngine
	 用于承载 skills、agents、workflow templates 等参数化 prompt 资源。

### 10.2 第一阶段不建议直接迁移的部分

1. 复杂 feature flags
	 现仓库很多 prompt 分支由实验开关控制。迁移初期应先裁剪成一个稳定主路径。

2. 完整 memory surfacing 系统
	 包括 relevant memories、nested memory、team memory 等。这部分能力很强，但不是 prompt architecture 的最小闭环。

3. fork prompt byte identity
	 这是 prompt cache 高度优化之后才值得保留的能力。没有共享缓存时，不必优先实现。

## 11. 推荐的新项目模块边界

建议在新项目中拆成以下模块：

```text
prompt/
	sections/
		base.ts
		language.ts
		tools.ts
		safety.ts
		memory.ts
	registry/
		sectionRegistry.ts
	assemble/
		getDefaultSystemPrompt.ts
		buildEffectiveSystemPrompt.ts
	context/
		getUserContext.ts
		getSystemContext.ts
	attachments/
		createSystemReminderMessage.ts
		injectDynamicAttachments.ts
	transport/
		splitSystemPromptBlocks.ts
		buildApiPromptBlocks.ts
	templates/
		skillTemplates.ts
		agentTemplates.ts
```

这样的收益是：

- prompt 文案变更不会影响 transport 层。
- memory 或 skill 扩展不会污染主装配器。
- API 切换时只需替换 transport adapter。
- prompt cache 策略可以独立演进。

## 12. 最小可复刻版本

如果只做一个精简版本，建议先实现以下最小闭环：

1. string[] 形式的 system prompt。
2. 静态 section 与动态 section 分离。
3. default/custom/append/agent 四级优先级组装器。
4. userContext 与 systemContext 双通道注入。
5. 一个统一的 system-reminder attachment wrapper。
6. 一个简单的 skill 模板引擎。
7. 一个 transport adapter，把 prompt 数组转成 API block。

只要这七个点在，新项目就已经具备这套架构的骨架了。

## 13. 总结

这个仓库的 prompt 管理体系，本质上是一个面向运行时的 prompt orchestration system，而不是静态 prompt 文件集合。它的关键价值不在于 prompt 文案本身，而在于以下设计原则：

- 用分块数组表示 system prompt，而不是单字符串。
- 用 section registry 管理动态 prompt 片段。
- 用显式优先级处理 agent/custom/append/override。
- 用 userContext 和 systemContext 区分不同来源的上下文。
- 用 system-reminder 附件承载动态、增量、按轮变化的信息。
- 在 transport 层而不是组装层处理 API block 与缓存控制。
- 把 skill 抽象成参数化 prompt 模板。

如果要重构到另一个项目，最重要的不是复制现有 prompt，而是保留这些边界。只要这些边界还在，具体文案、模型、工具和业务流程都可以替换。
