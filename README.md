# Freed

一个支持深度本地化定制、可多 Agent 协作的终端开发助手。

## 快速上手

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 安装 CLI 到本地
pnpm --filter @freed/cli link --global

# 运行
freed
```

## 开发

```bash
# 运行测试
pnpm test

# 类型检查
pnpm typecheck

# 开发模式（监听文件变化）
pnpm dev
```

## 配置

首次运行时，Freed 会在 `~/.freed/` 下创建默认配置目录。

你可以通过编辑 `~/.freed/agents/agents.md` 来配置 Agent，在 `~/.freed/mcp/servers.json` 里配置 MCP Server。

## 架构

参见 [arch.md](./arch.md)

## 功能

参见 [feature.md](./feature.md)
