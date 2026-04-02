import fs from 'node:fs/promises';
import path from 'node:path';
import type { AnyToolDefinition } from './types.js';

export const readFileTool: AnyToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file at the given path.',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to the file.' },
      startLine: { type: 'number', description: 'Optional 1-based start line.' },
      endLine: { type: 'number', description: 'Optional 1-based end line (inclusive).' },
    },
    required: ['path'],
  },
  async execute(input) {
    const { path: filePath, startLine, endLine } = input as {
      path: string;
      startLine?: number;
      endLine?: number;
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n');
        const start = (startLine ?? 1) - 1;
        const end = endLine ?? lines.length;
        return { success: true, output: lines.slice(start, end).join('\n') };
      }
      return { success: true, output: content };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

export const writeFileTool: AnyToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file, creating it if it does not exist.',
  riskLevel: 'ask',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to write.' },
      content: { type: 'string', description: 'Content to write.' },
    },
    required: ['path', 'content'],
  },
  async execute(input) {
    const { path: filePath, content } = input as { path: string; content: string };
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, output: `Written to ${filePath}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

export const listDirTool: AnyToolDefinition = {
  name: 'list_dir',
  description: 'List files and subdirectories in a directory.',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path.' },
    },
    required: ['path'],
  },
  async execute(input) {
    const { path: dirPath } = input as { path: string };
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      return { success: true, output: lines.join('\n') };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
