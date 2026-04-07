import { describe, it, expect } from 'vitest';
import { grepTool } from '../grep-tool.js';

describe('grepTool', () => {
  const testDir = '/Users/yulizhou/Projects/freed/packages/core/src';

  it('should find files with pattern', async () => {
    const result = await grepTool.execute({ pattern: 'ToolRegistry' }, testDir);
    expect(result.success).toBe(true);
    expect(result.output).toContain('tool-registry.ts');
  });

  it('should support case insensitive search', async () => {
    const result = await grepTool.execute({ pattern: 'toolregistry', '-i': true }, testDir);
    expect(result.success).toBe(true);
  });

  it('should support content mode', async () => {
    const result = await grepTool.execute(
      { pattern: 'ToolRegistry', output_mode: 'content' },
      testDir
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('ToolRegistry');
  });

  it('should handle no matches', async () => {
    const result = await grepTool.execute(
      { pattern: 'NONEXISTENT_SEARCH_PATTERN_ABCXYZ123' },
      '/tmp'
    );
    expect(result.success).toBe(true);
    expect(result.output).toBe('No files found.');
  });

  it('should support path option', async () => {
    const result = await grepTool.execute(
      { pattern: 'export', path: testDir },
      '/Users/yulizhou/Projects/freed'
    );
    expect(result.success).toBe(true);
  });
});
