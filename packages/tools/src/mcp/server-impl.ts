import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPServerConfig } from './types.js';
import type { AnyToolDefinition } from '../types.js';
import { adaptMCPTool } from './tool-adapter.js';

export interface MCPServerHandle {
  name: string;
  tools: AnyToolDefinition[];
  close(): Promise<void>;
  client: Client;
}

export class StdioMCPServer implements MCPServerHandle {
  name: string;
  tools: AnyToolDefinition[] = [];
  client: Client;
  private transport: StdioClientTransport | null = null;

  constructor(
    private config: MCPServerConfig,
    private clientName: string = 'freed-mcp-client',
    private clientVersion: string = '1.0.0'
  ) {
    this.name = config.name;
    this.client = new Client({ name: this.clientName, version: this.clientVersion });
  }

  async start(): Promise<void> {
    if (!this.config.command) {
      throw new Error(`StdioMCPServer requires command for server: ${this.name}`);
    }

    // StdioClientTransport handles spawning the subprocess internally
    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args ?? [],
      env: this.config.env ?? {},
      stderr: 'inherit',
    });

    // Connect with timeout
    await Promise.race([
      this.client.connect(this.transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Startup timeout for ${this.name}`)), 30_000)
      ),
    ]);

    // List tools using the client method
    const { tools } = await this.client.listTools();
    this.tools = tools.map((t) =>
      adaptMCPTool(
        this.name,
        {
          name: t.name,
          ...(t.description !== undefined && { description: t.description }),
          inputSchema: t.inputSchema as Record<string, unknown>,
        },
        this.client
      )
    );
  }

  async close(): Promise<void> {
    await this.client.close();
    await this.transport?.close();
  }
}

export class HttpMCPServer implements MCPServerHandle {
  name: string;
  tools: AnyToolDefinition[] = [];
  client: Client;
  private transport: StreamableHTTPClientTransport | null = null;

  constructor(
    private config: MCPServerConfig,
    private clientName: string = 'freed-mcp-client',
    private clientVersion: string = '1.0.0'
  ) {
    this.name = config.name;
    this.client = new Client({ name: this.clientName, version: this.clientVersion });
  }

  async start(): Promise<void> {
    if (!this.config.url) {
      throw new Error(`HttpMCPServer requires url for server: ${this.name}`);
    }

    const url = new URL(this.config.url);
    this.transport = new StreamableHTTPClientTransport(url, {
      requestInit: this.config.headers ? { headers: this.config.headers } : {},
    });

    await this.client.connect(this.transport as any);

    // List tools using the client method
    const { tools } = await this.client.listTools();
    this.tools = tools.map((t) =>
      adaptMCPTool(
        this.name,
        {
          name: t.name,
          ...(t.description !== undefined && { description: t.description }),
          inputSchema: t.inputSchema as Record<string, unknown>,
        },
        this.client
      )
    );
  }

  async close(): Promise<void> {
    await this.client.close();
    await this.transport?.close();
  }
}

export async function createMCPServer(config: MCPServerConfig): Promise<MCPServerHandle> {
  if (config.url) {
    const server = new HttpMCPServer(config);
    await server.start();
    return server;
  } else if (config.command) {
    const server = new StdioMCPServer(config);
    await server.start();
    return server;
  } else {
    throw new Error(`MCPServerConfig must have either command (stdio) or url (HTTP): ${config.name}`);
  }
}
