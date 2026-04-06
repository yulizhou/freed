import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MCPConfigSchema, type MCPConfig, type MCPServerConfig } from './types.js';

// Use vi.mock compatible import for testability
const fsModule = fs;

export function getGlobalConfigPath(): string {
  return path.join(os.homedir(), '.freed', 'mcp', 'servers.json');
}

export function getProjectConfigPath(projectDir: string): string {
  return path.join(projectDir, '.freed', 'mcp', 'servers.json');
}

function loadConfigFile(filePath: string): MCPServerConfig[] {
  try {
    if (!fsModule.existsSync(filePath)) {
      return [];
    }
    const content = fsModule.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = MCPConfigSchema.safeParse(parsed);
    if (result.success) {
      return result.data.servers;
    } else {
      console.warn(`[MCP Config] Warning: Invalid config at ${filePath}: ${result.error.message}`);
      return [];
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn(`[MCP Config] Warning: Malformed JSON at ${filePath}`);
    }
    return [];
  }
}

export function loadMCPConfig(projectDir?: string): MCPConfig {
  const globalPath = getGlobalConfigPath();
  const globalServers = loadConfigFile(globalPath);

  let projectServers: MCPServerConfig[] = [];
  if (projectDir) {
    const projectPath = getProjectConfigPath(projectDir);
    projectServers = loadConfigFile(projectPath);
  }

  // Merge: project-level servers override global ones with the same name
  const serverMap = new Map<string, MCPServerConfig>();
  for (const server of globalServers) {
    serverMap.set(server.name, server);
  }
  for (const server of projectServers) {
    serverMap.set(server.name, server);
  }

  return { servers: Array.from(serverMap.values()) };
}
