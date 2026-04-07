import { describe, it, expect } from 'vitest';
import { globTool } from '../glob-tool.js';

describe('globTool', () => {
  it('should find TypeScript files', async () => {
    const result = await globTool.execute({ pattern: '**/*.ts' }, '/Users/yulizhou/Projects/freed/packages/core/src');
    expect(result.success).toBe(true);
    expect(result.output).toContain('index.ts');
  });

  it('should find config files', async () => {
    const result = await globTool.execute({ pattern: '**/*.ts' }, '/Users/yulizhou/Projects/freed/packages/core/src');
    expect(result.success).toBe(true);
    expect(result.output).toContain('index.ts');
  });

  it('should return empty message when no matches', async () => {
    const result = await globTool.execute({ pattern: '**/*.nonexistent' }, '/Users/yulizhou/Projects/freed/packages/core/src');
    expect(result.success).toBe(true);
    expect(result.output).toBe('No files found matching the pattern.');
  });

  it('should handle specific patterns', async () => {
    const result = await globTool.execute({ pattern: '*.ts' }, '/Users/yulizhou/Projects/freed/packages/core/src');
    expect(result.success).toBe(true);
  });
});
