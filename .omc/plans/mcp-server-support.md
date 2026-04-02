# Plan: MCP Server Support for Freed

## RALPLAN-DR Summary

### Principles
1. **Separate namespace isolation** — MCP tools prefixed `mcp__<server>__<tool>` to avoid collision with built-in tools
2. **Zero business-logic coupling** — MCP Gateway is a pure infrastructure layer; agent runtime never imports MCP SDK directly
3. **Config precedence** — project-level `.freed/mcp/servers.json` overrides global `~/.freed/mcp/servers.json`
4. **Transport agnostic** — stdio and HTTP/SSE both go through the same `MCPServer` abstraction with protocol-specific adapters

### Decision Drivers
- Both stdio and HTTP/SSE transports needed
- Separate MCP namespace in tool registry
- Global + project config files

### Viable Options
| Option | Approach | Pros | Cons |
|--------|---------|------|------|
| **A (chosen)** | `@modelcontextprotocol/sdk` Client + custom gateway | Full MCP spec compliance, stdio + HTTP/SSE built-in, active maintenance | Additional dependency |
| B | Roll own stdio parser | No new dep | Reinventing wheels, fragile |
| C | MCP over HTTP only, skip stdio | Simpler | Breaks most local servers (filesystem, memory) |

---

## Requirements Summary

Add MCP server connectivity to Freed so agents can call tools from any MCP-compatible server. Tools are namespaced `mcp__<serverName>__<toolName>` and registered into the `ToolRegistry` alongside built-in tools.

**Key constraints from arch.md:**
- Config files: `~/.freed/mcp/servers.json` (global) and `.freed/mcp/servers.json` (project)
- Package: `@modelcontextprotocol/sdk`
- Namespaced tools, converted to internal `ToolDescriptor` format
- Connection lifecycle managed by an `MCPGateway`

---

## Acceptance Criteria

- [ ] `@modelcontextprotocol/sdk` installed as dependency in `packages/tools`
- [ ] `packages/tools/src/mcp-gateway.ts` — `MCPGateway` class manages server lifecycle
- [ ] `packages/tools/src/mcp-server.ts` — `MCPServer` abstraction with stdio and HTTP/SSE transports
- [ ] `packages/tools/src/mcp-tool-adapter.ts` — converts MCP `Tool` to internal `AnyToolDefinition` with `mcp__<server>__<name>` prefix
- [ ] Config loading: global `~/.freed/mcp/servers.json` + project `.freed/mcp/servers.json`, merged with project overriding global
- [ ] `ToolRegistry.registerMany()` accepts MCP tools alongside built-ins
- [ ] `AgentRuntime` passes merged tool list (built-in + MCP) to model without awareness of MCP origin
- [ ] Graceful degradation: if a server fails to connect, log warning and skip it rather than crashing
- [ ] Unit tests for config loading, tool name prefixing, and transport initialization
- [ ] `freed doctor` reports MCP server connection status

---

## Implementation Steps

### Step 1 — Install `@modelcontextprotocol/sdk`

**File:** `packages/tools/package.json`
- Add `"@modelcontextprotocol/sdk": "^1.0.0"` to dependencies

### Step 2 — Create MCP server config types and loading

**File:** `packages/tools/src/mcp/types.ts`

```ts
export interface MCPServerConfig {
  command?: string;       // stdio: executable path
  args?: string[];        // stdio: args
  env?: Record<string, string>;
  url?: string;           // HTTP/SSE: server URL
  headers?: Record<string, string>; // HTTP/SSE: optional headers
  name: string;
  description?: string;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
}
```

**File:** `packages/tools/src/mcp/config-loader.ts`
- Load `~/.freed/mcp/servers.json` (global)
- Load `project/.freed/mcp/servers.json` (project, if exists)
- Merge: project-level keys override global keys
- Return `MCPConfig`

### Step 3 — MCP server transport abstraction

**File:** `packages/tools/src/mcp/server-impl.ts`

```ts
export interface MCPServerHandle {
  name: string;
  tools: AnyToolDefinition[];
  close(): Promise<void>;
}
```

Two transport implementations sharing the above interface:
- `StdioMCPServer`: spawns process via `execa`, communicates via stdio JSON-RPC
- `HttpMCPServer`: connects via `HTTPStreamableSSEServerTransport` from SDK

Both use `@modelcontextprotocol/sdk` (`Client` class) for protocol handling.

### Step 4 — MCP Gateway

**File:** `packages/tools/src/mcp-gateway.ts`

```ts
export class MCPGateway {
  private servers = new Map<string, MCPServerHandle>();

  async loadGlobal(configDir: string): Promise<void>;   // ~/.freed/mcp/servers.json
  async loadProject(projectDir: string): Promise<void>; // .freed/mcp/servers.json

  getAllTools(): AnyToolDefinition[];
  async close(): Promise<void>;
}
```

- `loadGlobal` + `loadProject` each call `MCPServerHandle` factory
- Merged tool list via `getAllTools()`
- `close()` terminates all server connections

### Step 5 — Integrate into tool registry initialization

**File:** `packages/tools/src/index.ts`
- After registering built-in tools, call `mcpGateway.getAllTools()` and `toolRegistry.registerMany(...)`

**File:** `apps/cli/src/app.ts`
- Pass `projectDir` to `MCPGateway.loadProject()` at session start

### Step 6 — Add MCP status to `freed doctor`

**File:** `packages/tools/src/mcp/doctor.ts`
- Attempt connections to all configured servers
- Report each as ✅ connected / ❌ failed with reason

---

## File Structure

```
packages/tools/src/
  mcp/
    types.ts          # MCPServerConfig, MCPConfig
    config-loader.ts  # load + merge global/project configs
    server-impl.ts    # StdioMCPServer, HttpMCPServer, MCPServerHandle
    doctor.ts         # connection health check
  mcp-gateway.ts      # MCPGateway orchestrator
  index.ts            # export mcpGateway, wire to toolRegistry
```

**New deps:** `@modelcontextprotocol/sdk` in `packages/tools`

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SDK version mismatch with Node 22 | Low | Medium | Pin to `^1.0.0`, test on Node 22 in CI |
| stdio server hangs / never exits | Medium | Low | 30s timeout on server startup, kill process |
| HTTP server unreachable | Medium | Low | Graceful log warning, don't crash session |
| Config file malformed | Low | Medium | Zod validation on load, skip invalid servers |

---

## Verification Steps

1. **Config loading:** Write test that merges global + project configs, asserts project overrides global
2. **Tool naming:** Assert a tool `read` from server `filesystem` becomes `mcp__filesystem__read`
3. **Stdio transport:** Spawn a known test MCP server (e.g., `npx @modelcontextprotocol/server-filesystem`), verify tools registered
4. **HTTP transport:** Spin up a minimal SSE MCP server, verify connection
5. **Registry integration:** `toolRegistry.list()` includes MCP tools after gateway loads
6. **Doctor command:** `freed doctor` output includes MCP server status section
