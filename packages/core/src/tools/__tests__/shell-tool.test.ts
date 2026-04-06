import { describe, it, expect } from 'vitest';
import { shellTool, classifyShellRisk } from '../shell-tool.js';

describe('classifyShellRisk', () => {
  it('should mark rm -rf as ask', () => {
    expect(classifyShellRisk('rm -rf /tmp/foo')).toBe('ask');
  });

  it('should mark git reset --hard as ask', () => {
    expect(classifyShellRisk('git reset --hard HEAD~1')).toBe('ask');
  });

  it('should mark sudo commands as ask', () => {
    expect(classifyShellRisk('sudo apt install vim')).toBe('ask');
  });

  it('should mark safe commands as safe', () => {
    expect(classifyShellRisk('echo hello')).toBe('safe');
    expect(classifyShellRisk('ls -la')).toBe('safe');
    expect(classifyShellRisk('cat README.md')).toBe('safe');
    expect(classifyShellRisk('npm test')).toBe('safe');
  });
});

describe('shellTool', () => {
  it('should execute a simple command', async () => {
    const result = await shellTool.execute({ command: 'echo "hello freed"' });
    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('hello freed');
  });

  it('should return error for failed command', async () => {
    const result = await shellTool.execute({ command: 'exit 1' });
    expect(result.success).toBe(false);
  });

  it('should capture stderr output', async () => {
    const result = await shellTool.execute({ command: 'ls /nonexistent_path_xyz 2>&1' });
    expect(result.success).toBe(false);
  });

  it('should respect cwd parameter', async () => {
    const result = await shellTool.execute({ command: 'pwd', cwd: '/tmp' });
    expect(result.success).toBe(true);
    // macOS resolves /tmp → /private/tmp via symlink
    expect(result.output.trim()).toMatch(/\/tmp$/);
  });
});
