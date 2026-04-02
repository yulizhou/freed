import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../tool-registry.js';
import { readFileTool, shellTool } from '../index.js';
import { FreedError } from '@freed/shared';

describe('ToolRegistry', () => {
  it('should register and retrieve a tool', () => {
    const registry = new ToolRegistry();
    registry.register(readFileTool);
    expect(registry.get('read_file')).toBe(readFileTool);
  });

  it('should throw FreedError for unknown tool', () => {
    const registry = new ToolRegistry();
    expect(() => registry.get('unknown_tool')).toThrowError(FreedError);
  });

  it('should list all registered tools', () => {
    const registry = new ToolRegistry();
    registry.registerMany([readFileTool, shellTool]);
    const list = registry.list();
    expect(list).toHaveLength(2);
  });

  it('should return tools for agent by name list', () => {
    const registry = new ToolRegistry();
    registry.registerMany([readFileTool, shellTool]);
    const tools = registry.forAgent(['read_file', 'shell', 'nonexistent']);
    expect(tools).toHaveLength(2);
  });

  it('should return false for has() on missing tool', () => {
    const registry = new ToolRegistry();
    expect(registry.has('missing')).toBe(false);
  });
});
