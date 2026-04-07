import fs from 'node:fs/promises';
import path from 'node:path';
import type { AnyToolDefinition } from './types.js';

/**
 * FileEditTool - Edit a file by replacing text.
 *
 * Simplified from cc-tools/FileEditTool:
 * - No UI layer
 * - No permission system
 * - No staleness checks
 * - No analytics
 * - No multi-edit support
 * - Core: replace old_string with new_string
 */
export const fileEditTool: AnyToolDefinition = {
  name: 'file_edit',
  description:
    'Edit a file by replacing a specific string with new content. Use this to modify specific sections of a file without rewriting the entire file.',
  riskLevel: 'ask',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file to edit.',
      },
      old_string: {
        type: 'string',
        description: 'The exact string to find and replace. Must match the content in the file exactly.',
      },
      new_string: {
        type: 'string',
        description: 'The replacement string.',
      },
      replace_all: {
        type: 'boolean',
        optional: true,
        description: 'If true, replace all occurrences of old_string. If false (default), replace only the first occurrence.',
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  async execute(input, cwd = process.cwd()) {
    const { file_path, old_string, new_string, replace_all = false } = input as {
      file_path: string;
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    };

    // Resolve relative paths
    const absolutePath = path.isAbsolute(file_path)
      ? file_path
      : path.resolve(cwd, file_path);

    // Validate inputs
    if (old_string === new_string) {
      return {
        success: false,
        output: '',
        error: 'No changes to make: old_string and new_string are identical.',
      };
    }

    try {
      // Read current file content
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
          return {
            success: false,
            output: '',
            error: `File not found: ${file_path}`,
          };
        }
        if (error.code === 'EACCES') {
          return {
            success: false,
            output: '',
            error: `Permission denied: ${file_path}`,
          };
        }
        throw err;
      }

      // Check if old_string exists
      const occurrences = replace_all
        ? content.split(old_string).length - 1
        : (content.includes(old_string) ? 1 : 0);

      if (occurrences === 0) {
        return {
          success: false,
          output: '',
          error: `String not found: "${old_string.substring(0, 50)}${old_string.length > 50 ? '...' : ''}"`,
        };
      }

      // Perform the replacement
      let updatedContent: string;
      if (replace_all) {
        updatedContent = content.split(old_string).join(new_string);
      } else {
        const index = content.indexOf(old_string);
        updatedContent = content.slice(0, index) + new_string + content.slice(index + old_string.length);
      }

      // Write back
      await fs.writeFile(absolutePath, updatedContent, 'utf-8');

      const action = replace_all ? 'Replaced all' : 'Replaced';
      return {
        success: true,
        output: `${action} ${occurrences} occurrence${occurrences === 1 ? '' : 's'} in ${file_path}`,
      };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      return {
        success: false,
        output: '',
        error: `Edit error: ${error.message}`,
      };
    }
  },
};
