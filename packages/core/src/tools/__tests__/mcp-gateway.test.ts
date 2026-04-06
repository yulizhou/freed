import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPGateway } from '../mcp-gateway.js';
import { ToolRegistry } from '../tool-registry.js';
import type { MCPServerHandle } from '../mcp/server-impl.js';
import type { AnyToolDefinition } from '../types.js';

// Hoisted mock refs
const { consoleWarn, consoleInfo, mockCreateMCPServer, mockLoadMCPConfig, mockFsExistsSync } = vi.hoisted(() => ({
  consoleWarn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  consoleInfo: vi.spyOn(console, 'info').mockImplementation(() => {}),
  mockCreateMCPServer: vi.fn(),
  mockLoadMCPConfig: vi.fn(),
  mockFsExistsSync: vi.fn(),
}));

vi.mock('../mcp/server-impl.js', () => ({
  createMCPServer: mockCreateMCPServer,
}));

vi.mock('../mcp/config-loader.js', () => ({
  loadMCPConfig: mockLoadMCPConfig,
  getGlobalConfigPath: vi.fn().mockReturnValue('/global/path'),
  getProjectConfigPath: vi.fn().mockReturnValue('/project/path'),
}));

vi.mock('fs', () => ({
  default: { existsSync: mockFsExistsSync },
  existsSync: mockFsExistsSync,
}));

function makeHandle(name: string, toolCount: number = 1): MCPServerHandle {
  const tools: AnyToolDefinition[] = Array.from({ length: toolCount }, (_, i) => ({
    name: `${name}-tool-${i}`,
    description: `Tool ${i} from ${name}`,
    inputSchema: {},
    riskLevel: 'safe' as const,
    execute: vi.fn().mockResolvedValue({ success: true, output: 'ok', error: '' }),
  }));
  return {
    name,
    tools,
    close: vi.fn().mockResolvedValue(undefined),
    client: {} as any,
  };
}

describe('MCPGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMCPServer.mockReset();
  });

  describe('loadGlobal', () => {
    it('skips when no global config file exists', async () => {
      mockFsExistsSync.mockReturnValue(false);
      const gateway = new MCPGateway(new ToolRegistry());
      await gateway.loadGlobal();
      expect(consoleInfo).toHaveBeenCalledWith(expect.stringContaining('No global MCP config'));
    });

    it('loads servers from global config when file exists', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockCreateMCPServer.mockResolvedValue(makeHandle('global-server', 2));
      mockLoadMCPConfig.mockReturnValue({ servers: [{ name: 'global-server', command: '/bin/server' }] });

      const gateway = new MCPGateway(new ToolRegistry());
      await gateway.loadGlobal();

      await new Promise((r) => setTimeout(r, 10));
      expect(mockCreateMCPServer).toHaveBeenCalled();
      expect(gateway.hasServer('global-server')).toBe(true);
    });
  });

  describe('loadProject', () => {
    it('skips when no project config file exists', async () => {
      mockFsExistsSync.mockReturnValue(false);
      const gateway = new MCPGateway(new ToolRegistry());
      await gateway.loadProject('/some/project');
      expect(consoleInfo).toHaveBeenCalledWith(expect.stringContaining('No project MCP config'));
    });
  });

  describe('getAllTools', () => {
    it('returns empty array when no servers loaded', () => {
      mockFsExistsSync.mockReturnValue(false);
      const gateway = new MCPGateway(new ToolRegistry());
      expect(gateway.getAllTools()).toEqual([]);
    });
  });

  describe('hasServer', () => {
    it('returns false before any server is loaded', () => {
      mockFsExistsSync.mockReturnValue(false);
      const gateway = new MCPGateway(new ToolRegistry());
      expect(gateway.hasServer('any-server')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('logs warning and continues when a server fails to load', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockCreateMCPServer.mockRejectedValue(new Error('startup failed'));
      mockLoadMCPConfig.mockReturnValue({ servers: [{ name: 'bad-server', command: '/bin/bad' }] });

      const gateway = new MCPGateway(new ToolRegistry());
      await gateway.loadGlobal();

      await new Promise((r) => setTimeout(r, 10));
      expect(gateway.hasServer('bad-server')).toBe(false);
      expect(consoleWarn).toHaveBeenCalled();
    });
  });
});
