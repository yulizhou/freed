import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adaptMCPTool } from '../mcp/tool-adapter.js';

describe('adaptMCPTool', () => {
  const mockClient = {
    callTool: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefixes tool name with server name', () => {
    const tool = { name: 'read', description: 'Read a file' };
    const adapted = adaptMCPTool('filesystem', tool, mockClient as any);
    expect(adapted.name).toBe('mcp__filesystem__read');
  });

  it('passes description through', () => {
    const tool = { name: 'list', description: 'List directory contents' };
    const adapted = adaptMCPTool('filesystem', tool, mockClient as any);
    expect(adapted.description).toBe('List directory contents');
  });

  it('uses medium risk level', () => {
    const tool = { name: 'read' };
    const adapted = adaptMCPTool('filesystem', tool, mockClient as any);
    expect(adapted.riskLevel).toBe('ask'); // MCP tools go through ApprovalEngine
  });

  it('calls client.callTool with correct tool name and input', async () => {
    mockClient.callTool.mockResolvedValue('file content');
    const tool = { name: 'read', description: 'Read a file' };
    const adapted = adaptMCPTool('filesystem', tool, mockClient as any);
    const result = await adapted.execute({ path: '/test.txt' });
    expect(mockClient.callTool).toHaveBeenCalledWith({ name: 'read', arguments: { path: '/test.txt' } });
    expect(result.success).toBe(true);
  });

  it('prefixes multiple tools from same server', () => {
    const tools = [
      { name: 'read' },
      { name: 'write' },
      { name: 'delete' },
    ];
    const adapted = tools.map((t) => adaptMCPTool('filesystem', t, mockClient as any));
    expect(adapted[0]!.name).toBe('mcp__filesystem__read');
    expect(adapted[1]!.name).toBe('mcp__filesystem__write');
    expect(adapted[2]!.name).toBe('mcp__filesystem__delete');
  });
});
