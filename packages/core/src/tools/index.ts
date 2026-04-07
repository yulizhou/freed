export { ToolRegistry } from './tool-registry.js';
export type { ToolDefinition, AnyToolDefinition } from './types.js';
export { readFileTool, writeFileTool, listDirTool } from './file-tools.js';
export { shellTool, classifyShellRisk } from './shell-tool.js';
export { gitStatusTool, gitDiffTool, gitLogTool } from './git-tools.js';
export { globTool } from './glob-tool.js';
export { grepTool } from './grep-tool.js';
export { fileEditTool } from './file-edit-tool.js';
export { webFetchTool } from './web-tool.js';
export { askUserQuestionTool } from './ask-tool.js';
export { collectEnvContext } from './env-context.js';
export { MCPGateway } from './mcp-gateway.js';

// Convenience: all built-in tools in one array
import { readFileTool, writeFileTool, listDirTool } from './file-tools.js';
import { shellTool } from './shell-tool.js';
import { gitStatusTool, gitDiffTool, gitLogTool } from './git-tools.js';
import { globTool } from './glob-tool.js';
import { grepTool } from './grep-tool.js';
import { fileEditTool } from './file-edit-tool.js';
import { webFetchTool } from './web-tool.js';
import { askUserQuestionTool } from './ask-tool.js';
import { MCPGateway } from './mcp-gateway.js';
import { ToolRegistry } from './tool-registry.js';

export const BUILT_IN_TOOLS = [
  readFileTool,
  writeFileTool,
  listDirTool,
  shellTool,
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  globTool,
  grepTool,
  fileEditTool,
  webFetchTool,
  askUserQuestionTool,
];

// Tool registry singleton
export const toolRegistry = new ToolRegistry();

// Register built-in tools
toolRegistry.registerMany(BUILT_IN_TOOLS);

// MCP Gateway singleton - loads global MCP servers at startup
const mcpGateway = new MCPGateway(toolRegistry);

// Load global MCP servers at startup
try {
  await mcpGateway.loadGlobal();
  const mcpTools = mcpGateway.getAllTools();
  if (mcpTools.length > 0) {
    toolRegistry.registerMany(mcpTools);
    console.info(`[tools] Registered ${mcpTools.length} MCP tools`);
  }
} catch (err) {
  console.warn('[tools] Failed to load MCP servers:', err);
}

export { mcpGateway };
