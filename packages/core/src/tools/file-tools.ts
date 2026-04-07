import fs from 'node:fs/promises';
import path from 'node:path';
import type { AnyToolDefinition } from './types.js';

// Device files that would hang if read
const BLOCKED_DEVICE_PATHS = new Set(['/dev/zero', '/dev/null', '/dev/urandom']);

export const readFileTool: AnyToolDefinition = {
  name: 'read_file',
  description:
    'Read the contents of a file at the given path. Supports line range selection with offset and limit parameters.',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to the file.' },
      offset: {
        type: 'number',
        optional: true,
        description: 'Number of lines to skip before reading. Default: 0.',
      },
      limit: {
        type: 'number',
        optional: true,
        description: 'Maximum number of lines to read. Default: unlimited.',
      },
      '-n': {
        type: 'boolean',
        optional: true,
        description: 'Show line numbers in output.',
      },
    },
    required: ['path'],
  },
  async execute(input, cwd = process.cwd()) {
    const { path: filePath, offset = 0, limit, '-n': showLineNumbers } = input as {
      path: string;
      offset?: number;
      limit?: number;
      '-n'?: boolean;
    };

    // Resolve relative paths
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(cwd, filePath);

    // Security: block device files that could hang
    if (BLOCKED_DEVICE_PATHS.has(absolutePath)) {
      return {
        success: false,
        output: '',
        error: 'Cannot read device files.',
      };
    }

    // Validate parameters
    if (offset < 0) {
      return {
        success: false,
        output: '',
        error: 'offset must be non-negative.',
      };
    }

    if (limit !== undefined && limit < 0) {
      return {
        success: false,
        output: '',
        error: 'limit must be non-negative.',
      };
    }

    try {
      const stat = await fs.stat(absolutePath);

      // Check if it's a directory
      if (stat.isDirectory()) {
        return {
          success: false,
          output: '',
          error: 'Path is a directory, not a file.',
        };
      }

      // Read file content
      const content = await fs.readFile(absolutePath, 'utf-8');
      const allLines = content.split('\n');

      // Apply offset and limit
      const startLine = offset;
      const endLine = limit !== undefined ? offset + limit : allLines.length;
      const selectedLines = allLines.slice(startLine, endLine);

      // Format output
      let output: string;
      if (showLineNumbers) {
        output = selectedLines
          .map((line, i) => `${startLine + i + 1}: ${line}`)
          .join('\n');
      } else {
        output = selectedLines.join('\n');
      }

      // Add metadata if truncated
      const totalLines = allLines.length;
      if (endLine < totalLines) {
        output += `\n... (showing ${endLine - startLine} of ${totalLines} lines, offset ${offset})`;
      }

      return { success: true, output };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return {
          success: false,
          output: '',
          error: `File not found: ${filePath}`,
        };
      }
      if (error.code === 'EACCES') {
        return {
          success: false,
          output: '',
          error: `Permission denied: ${filePath}`,
        };
      }
      if (error.code === 'EISDIR') {
        return {
          success: false,
          output: '',
          error: `Path is a directory: ${filePath}`,
        };
      }
      return {
        success: false,
        output: '',
        error: `Read error: ${error.message}`,
      };
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
