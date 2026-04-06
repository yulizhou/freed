import { loadMCPConfig } from './config-loader.js';
import { createMCPServer } from './server-impl.js';
import type { MCPConfig } from './types.js';

export interface ServerHealthResult {
  name: string;
  status: 'connected' | 'failed';
  reason?: string;
  toolCount?: number;
}

export async function checkMCPServers(projectDir?: string): Promise<ServerHealthResult[]> {
  const config = loadMCPConfig(projectDir);
  const results: ServerHealthResult[] = [];

  for (const serverConfig of config.servers) {
    try {
      const server = await createMCPServer(serverConfig);
      results.push({
        name: serverConfig.name,
        status: 'connected',
        toolCount: server.tools.length,
      });
      await server.close();
    } catch (err) {
      results.push({
        name: serverConfig.name,
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
