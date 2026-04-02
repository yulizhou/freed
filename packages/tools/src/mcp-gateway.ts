import { loadMCPConfig, getGlobalConfigPath, getProjectConfigPath } from './mcp/config-loader.js';
import type { MCPServerConfig, MCPConfig } from './mcp/types.js';
import { createMCPServer, type MCPServerHandle } from './mcp/server-impl.js';
import type { AnyToolDefinition } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolRegistry } from './tool-registry.js';

export class MCPGateway {
  private servers = new Map<string, MCPServerHandle>();
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  async loadGlobal(): Promise<void> {
    const globalPath = getGlobalConfigPath();
    if (!fs.existsSync(globalPath)) {
      console.info('[mcp-gateway] No global MCP config found, skipping');
      return;
    }

    const config = loadMCPConfig();
    await this.loadServers(config);
  }

  async loadProject(projectDir: string): Promise<void> {
    const projectPath = getProjectConfigPath(projectDir);
    if (!fs.existsSync(projectPath)) {
      console.info('[mcp-gateway] No project MCP config found, skipping');
      return;
    }

    const config = loadMCPConfig(projectDir);
    await this.loadServers(config);
  }

  private async loadServers(config: MCPConfig): Promise<void> {
    for (const serverConfig of config.servers) {
      try {
        const existing = this.servers.get(serverConfig.name);
        if (existing) {
          console.warn(`[mcp-gateway] Server "${serverConfig.name}" already loaded, skipping duplicate`);
          continue;
        }

        const server = await createMCPServer(serverConfig);
        this.servers.set(serverConfig.name, server);
        console.info(`[mcp-gateway] Loaded MCP server: ${serverConfig.name} (${server.tools.length} tools)`);
      } catch (err) {
        console.warn(`[mcp-gateway] Failed to load server "${serverConfig.name}": ${err}`);
      }
    }
  }

  getAllTools(): AnyToolDefinition[] {
    const tools: AnyToolDefinition[] = [];
    for (const server of this.servers.values()) {
      tools.push(...server.tools);
    }
    return tools;
  }

  hasServer(name: string): boolean {
    return this.servers.has(name);
  }

  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    for (const server of this.servers.values()) {
      closePromises.push(server.close().catch((err) => {
        console.warn(`[mcp-gateway] Error closing server "${server.name}": ${err}`);
      }));
    }
    await Promise.all(closePromises);
    this.servers.clear();
  }
}
