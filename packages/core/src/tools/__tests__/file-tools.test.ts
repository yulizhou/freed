import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileTool, writeFileTool, listDirTool } from '../file-tools.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('readFileTool', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'freed-tools-'));
    testFile = path.join(tmpDir, 'test.txt');
    await fs.writeFile(testFile, 'line1\nline2\nline3\nline4\nline5', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should read the full file', async () => {
    const result = await readFileTool.execute({ path: testFile });
    expect(result.success).toBe(true);
    expect(result.output).toBe('line1\nline2\nline3\nline4\nline5');
  });

  it('should read a line range', async () => {
    const result = await readFileTool.execute({ path: testFile, startLine: 2, endLine: 3 });
    expect(result.success).toBe(true);
    expect(result.output).toBe('line2\nline3');
  });

  it('should return error for non-existent file', async () => {
    const result = await readFileTool.execute({ path: '/nonexistent/file.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('writeFileTool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'freed-tools-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should write content to a new file', async () => {
    const filePath = path.join(tmpDir, 'output.txt');
    const result = await writeFileTool.execute({ path: filePath, content: 'hello world' });
    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('hello world');
  });

  it('should create intermediate directories', async () => {
    const filePath = path.join(tmpDir, 'a', 'b', 'c.txt');
    const result = await writeFileTool.execute({ path: filePath, content: 'nested' });
    expect(result.success).toBe(true);
  });

  it('should have ask risk level', () => {
    expect(writeFileTool.riskLevel).toBe('ask');
  });
});

describe('listDirTool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'freed-tools-'));
    await fs.writeFile(path.join(tmpDir, 'file.txt'), '');
    await fs.mkdir(path.join(tmpDir, 'subdir'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should list directory contents', async () => {
    const result = await listDirTool.execute({ path: tmpDir });
    expect(result.success).toBe(true);
    expect(result.output).toContain('file.txt');
    expect(result.output).toContain('subdir/');
  });

  it('should return error for non-existent dir', async () => {
    const result = await listDirTool.execute({ path: '/nonexistent/dir' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
