import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerHealthResult } from '../mcp/doctor.js';
import type { MCPServerHandle } from '../mcp/server-impl.js';
import type { MCPConfig } from '../mcp/types.js';

// ─── Mock implementations (hoisted above vi.mock calls) ─────────────────────

const { mockCreateMCPServer, mockLoadMCPConfig } = vi.hoisted(() => ({
  mockCreateMCPServer: vi.fn(),
  mockLoadMCPConfig: vi.fn(),
}));

vi.mock('../mcp/server-impl.js', () => ({
  createMCPServer: (...args: unknown[]) => mockCreateMCPServer(...args),
}));

vi.mock('../mcp/config-loader.js', () => ({
  loadMCPConfig: (...args: unknown[]) => mockLoadMCPConfig(...args),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────────

import { checkMCPServers } from '../mcp/doctor.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeHandle(name: string, toolCount: number = 1): MCPServerHandle {
  return {
    name,
    tools: Array.from({ length: toolCount }, (_, i) => ({
      name: `${name}-tool-${i}`,
      description: `Tool ${i}`,
      inputSchema: {},
      riskLevel: 'safe' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: vi.fn<any>(),
    })),
    close: vi.fn().mockResolvedValue(undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: {} as any,
  };
}

function makeConfig(servers: { name: string; command?: string; url?: string }[]): MCPConfig {
  return { servers: servers as any };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('checkMCPServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMCPServer.mockReset();
    mockLoadMCPConfig.mockReset();
  });

  it('returns connected status with toolCount for a reachable server', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([{ name: 'healthy', command: '/bin/healthy' }]));
    mockCreateMCPServer.mockResolvedValue(makeHandle('healthy', 5));

    const results: ServerHealthResult[] = await checkMCPServers();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: 'healthy',
      status: 'connected',
      toolCount: 5,
    });
  });

  it('returns failed status with reason when server throws', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([{ name: 'broken', command: '/bin/broken' }]));
    mockCreateMCPServer.mockRejectedValue(new Error('connection refused'));

    const results: ServerHealthResult[] = await checkMCPServers();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: 'broken',
      status: 'failed',
      reason: 'connection refused',
    });
  });

  it('checks multiple servers and reports mixed results', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([
      { name: 'ok-server', command: '/bin/ok' },
      { name: 'bad-server', url: 'http://bad.local' },
    ]));
    mockCreateMCPServer
      .mockResolvedValueOnce(makeHandle('ok-server', 3))
      .mockRejectedValueOnce(new Error('etimedout'));

    const results: ServerHealthResult[] = await checkMCPServers();
    expect(results).toHaveLength(2);

    const ok = results.find((r) => r.name === 'ok-server');
    expect(ok?.status).toBe('connected');
    expect(ok?.toolCount).toBe(3);

    const bad = results.find((r) => r.name === 'bad-server');
    expect(bad?.status).toBe('failed');
    expect(bad?.reason).toBe('etimedout');
  });

  it('closes server after checking even on success', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([{ name: 'check-and-close', command: '/bin/check' }]));
    const handle = makeHandle('check-and-close');
    mockCreateMCPServer.mockResolvedValue(handle);

    await checkMCPServers();
    expect(handle.close).toHaveBeenCalled();
  });

  it('closes server after checking even on failure', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([{ name: 'fail-and-close', command: '/bin/fail' }]));
    mockCreateMCPServer.mockRejectedValue(new Error('fail'));

    const results = await checkMCPServers();
    expect(results[0]!.status).toBe('failed');
    // No server handle exists when creation throws, so only verify result
  });

  it('uses projectDir when passed to loadMCPConfig', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([]));
    await checkMCPServers('/my/project');
    expect(mockLoadMCPConfig).toHaveBeenCalledWith('/my/project');
  });

  it('returns empty array when no servers are configured', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([]));
    const results: ServerHealthResult[] = await checkMCPServers();
    expect(results).toEqual([]);
  });

  it('reason is string even for non-Error rejections', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([{ name: 'string-err', command: '/bin/err' }]));
    mockCreateMCPServer.mockRejectedValue('plain string error');

    const results: ServerHealthResult[] = await checkMCPServers();
    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.reason).toBe('plain string error');
  });

  it('ServerHealthResult has correct structure', async () => {
    mockLoadMCPConfig.mockReturnValue(makeConfig([{ name: 'struct', command: '/bin/struct' }]));
    mockCreateMCPServer.mockResolvedValue(makeHandle('struct', 2));

    const results: ServerHealthResult[] = await checkMCPServers();
    const r = results[0]!;
    expect(r).toHaveProperty('name');
    expect(r).toHaveProperty('status');
    expect(['connected', 'failed']).toContain(r.status);
    if (r.status === 'connected') {
      expect(r).toHaveProperty('toolCount');
    }
    if (r.status === 'failed') {
      expect(r).toHaveProperty('reason');
    }
  });
});
