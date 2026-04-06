import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MCPServerConfig } from '../mcp/types.js';

// ─── Stable mock refs ─────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn<any>().mockResolvedValue(undefined),
    close: vi.fn<any>().mockResolvedValue(undefined),
    listTools: vi.fn<any>(),
  })),
  StdioClientTransport: vi.fn().mockImplementation(() => ({
    close: vi.fn<any>().mockResolvedValue(undefined),
  })),
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({
    close: vi.fn<any>().mockResolvedValue(undefined),
  })),
  adaptMCPTool: vi.fn<any>().mockReturnValue({
    name: 'mcp__test__tool',
    description: 'Adapted tool',
    inputSchema: {},
    riskLevel: 'ask' as const,
    execute: vi.fn(),
  }),
}));

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: mocks.Client,
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: mocks.StdioClientTransport,
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: mocks.StreamableHTTPClientTransport,
}));

vi.mock('./mcp/tool-adapter.js', () => ({
  adaptMCPTool: mocks.adaptMCPTool,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────────

import { StdioMCPServer, HttpMCPServer, createMCPServer } from '../mcp/server-impl.js';

// ─── Test helpers ──────────────────────────────────────────────────────────────

const makeTool = (name: string) => ({
  name,
  description: `Description for ${name}`,
  inputSchema: { type: 'object' },
});

function makeStdioConfig(name: string, command: string, args?: string[], env?: Record<string, string>): MCPServerConfig {
  return { name, command, args, env } as MCPServerConfig;
}

function makeHttpConfig(name: string, url: string, headers?: Record<string, string>): MCPServerConfig {
  return { name, url, headers } as MCPServerConfig;
}

function getClient(stub: any) {
  return stub.mock.calls[0][0];
}

// ─── StdioMCPServer tests ─────────────────────────────────────────────────────

describe('StdioMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a command in the config', async () => {
    const server = new StdioMCPServer({ name: 'no-cmd' } as MCPServerConfig);
    await expect(server.start()).rejects.toThrow(/requires command/);
  });

  it('calls client.connect with StdioClientTransport', async () => {
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [makeTool('my-tool')] }),
    }));
    const server = new StdioMCPServer(makeStdioConfig('stdio-test', '/bin/mcp-server', ['--arg']));
    await server.start();
    expect(server.client).toBeDefined();
  });

  it('loads tools via client.listTools and adapts them', async () => {
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [makeTool('tool-a'), makeTool('tool-b')] }),
    }));
    const server = new StdioMCPServer(makeStdioConfig('stdio-test', '/bin/server'));
    await server.start();
    expect(server.tools).toHaveLength(2);
    expect(server.tools[0].name).toContain('mcp__stdio-test__tool-a');
  });

  it('sets the server name from config', () => {
    const server = new StdioMCPServer(makeStdioConfig('my-named-server', '/bin/server'));
    expect(server.name).toBe('my-named-server');
  });

  it('close calls client.close and transport.close', async () => {
    const transportClose = vi.fn<any>().mockResolvedValue(undefined);
    mocks.StdioClientTransport.mockImplementationOnce(() => ({
      close: transportClose,
    }));
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [] }),
    }));
    const server = new StdioMCPServer(makeStdioConfig('stdio-test', '/bin/server'));
    await server.start();
    await server.close();
    const clientInstance = mocks.Client.mock.results[0].value;
    expect(clientInstance.close).toHaveBeenCalled();
    expect(transportClose).toHaveBeenCalled();
  });
});

// ─── HttpMCPServer tests ───────────────────────────────────────────────────────

describe('HttpMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires a url in the config', async () => {
    const server = new HttpMCPServer({ name: 'no-url' } as MCPServerConfig);
    await expect(server.start()).rejects.toThrow(/requires url/);
  });

  it('calls client.connect with StreamableHTTPClientTransport', async () => {
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [makeTool('http-tool')] }),
    }));
    const server = new HttpMCPServer(makeHttpConfig('http-test', 'http://localhost:8080/mcp'));
    await server.start();
    expect(server.client).toBeDefined();
  });

  it('passes custom headers to StreamableHTTPClientTransport', async () => {
    mocks.StreamableHTTPClientTransport.mockImplementationOnce(() => ({
      close: vi.fn<any>().mockResolvedValue(undefined),
    }));
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [] }),
    }));
    const server = new HttpMCPServer(makeHttpConfig('http-test', 'http://localhost:8080', { Authorization: 'Bearer tok' }));
    await server.start();
    expect(mocks.StreamableHTTPClientTransport).toHaveBeenCalled();
  });

  it('loads tools and adapts them', async () => {
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [makeTool('get-info'), makeTool('list-items')] }),
    }));
    const server = new HttpMCPServer(makeHttpConfig('http-test', 'http://localhost:8080'));
    await server.start();
    expect(server.tools).toHaveLength(2);
    expect(server.tools[0].name).toContain('mcp__http-test__get-info');
  });

  it('close calls client.close and transport.close', async () => {
    const transportClose = vi.fn<any>().mockResolvedValue(undefined);
    mocks.StreamableHTTPClientTransport.mockImplementationOnce(() => ({
      close: transportClose,
    }));
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [] }),
    }));
    const server = new HttpMCPServer(makeHttpConfig('http-test', 'http://localhost:8080'));
    await server.start();
    await server.close();
    const clientInstance = mocks.Client.mock.results[0].value;
    expect(clientInstance.close).toHaveBeenCalled();
    expect(transportClose).toHaveBeenCalled();
  });
});

// ─── createMCPServer tests ─────────────────────────────────────────────────────

describe('createMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an HttpMCPServer when url is present', async () => {
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [] }),
    }));
    const handle = await createMCPServer(makeHttpConfig('via-url', 'http://localhost:9000'));
    expect(handle.name).toBe('via-url');
  });

  it('creates a StdioMCPServer when command is present but no url', async () => {
    mocks.Client.mockImplementationOnce(() => ({
      connect: vi.fn<any>().mockResolvedValue(undefined),
      close: vi.fn<any>().mockResolvedValue(undefined),
      listTools: vi.fn<any>().mockResolvedValue({ tools: [] }),
    }));
    const handle = await createMCPServer(makeStdioConfig('via-cmd', '/bin/mcp'));
    expect(handle.name).toBe('via-cmd');
  });

  it('throws when neither url nor command is provided', async () => {
    await expect(createMCPServer({ name: 'neither' } as MCPServerConfig)).rejects.toThrow(/must have either command/);
  });
});
