import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileEditTool } from '../file-edit-tool.js';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('fileEditTool', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join('/tmp', 'freed-edit-'));
    testFile = path.join(tmpDir, 'test.txt');
    await fs.writeFile(testFile, 'line1\nline2\nline3\nline4', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should replace a string', async () => {
    const result = await fileEditTool.execute({
      file_path: testFile,
      old_string: 'line2',
      new_string: 'REPLACED',
    });
    expect(result.success).toBe(true);
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('line1\nREPLACED\nline3\nline4');
  });

  it('should replace all occurrences with replace_all flag', async () => {
    await fs.writeFile(testFile, 'foo\nbar\nfoo\nbaz', 'utf-8');
    const result = await fileEditTool.execute({
      file_path: testFile,
      old_string: 'foo',
      new_string: 'REPLACED',
      replace_all: true,
    });
    expect(result.success).toBe(true);
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('REPLACED\nbar\nREPLACED\nbaz');
  });

  it('should only replace first occurrence without replace_all', async () => {
    await fs.writeFile(testFile, 'foo\nbar\nfoo\nbaz', 'utf-8');
    const result = await fileEditTool.execute({
      file_path: testFile,
      old_string: 'foo',
      new_string: 'REPLACED',
    });
    expect(result.success).toBe(true);
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('REPLACED\nbar\nfoo\nbaz');
  });

  it('should return error for non-existent file', async () => {
    const result = await fileEditTool.execute({
      file_path: '/nonexistent/file.txt',
      old_string: 'test',
      new_string: 'replaced',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
  });

  it('should return error when old_string not found', async () => {
    const result = await fileEditTool.execute({
      file_path: testFile,
      old_string: 'NOTFOUND',
      new_string: 'replaced',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('String not found');
  });

  it('should return error when old_string equals new_string', async () => {
    const result = await fileEditTool.execute({
      file_path: testFile,
      old_string: 'line2',
      new_string: 'line2',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('identical');
  });

  it('should handle multi-line strings', async () => {
    await fs.writeFile(testFile, 'line1\nline2\nline3', 'utf-8');
    const result = await fileEditTool.execute({
      file_path: testFile,
      old_string: 'line1\nline2',
      new_string: 'NEW\nNEW2',
    });
    expect(result.success).toBe(true);
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('NEW\nNEW2\nline3');
  });
});
