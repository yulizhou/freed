import type { AnyToolDefinition } from '../types.js';

// The MCP tool type from @modelcontextprotocol/sdk
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export function adaptMCPTool(
  serverName: string,
  tool: MCPTool,
  client: { callTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown> }
): AnyToolDefinition {
  const wrappedName = `mcp__${serverName}__${tool.name}`;
  return {
    name: wrappedName,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema ?? {},
    riskLevel: 'ask', // MCP tools go through ApprovalEngine, so 'ask' is appropriate
    async execute(input: Record<string, unknown>) {
      const result = await client.callTool({ name: tool.name, arguments: input });
      return {
        success: true,
        output: typeof result === 'string' ? result : JSON.stringify(result),
        error: '',
      };
    },
  };
}
