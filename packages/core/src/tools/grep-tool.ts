import { x } from 'tinyexec';
import path from 'node:path';
import type { AnyToolDefinition } from './types.js';

type OutputMode = 'files_with_matches' | 'content' | 'count';

/**
 * GrepTool - Search file contents with regex.
 *
 * Simplified from cc-tools/GrepTool:
 * - No UI layer
 * - No permission system
 * - No analytics
 * - No staleness checks
 * - Uses tinyexec + ripgrep
 */
export const grepTool: AnyToolDefinition = {
  name: 'grep',
  description:
    'Search file contents using regex. Finds files containing a pattern or shows matching lines with optional context.',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regular expression pattern to search for.',
      },
      path: {
        type: 'string',
        optional: true,
        description: 'File or directory to search in. Defaults to current directory.',
      },
      output_mode: {
        type: 'string',
        enum: ['files_with_matches', 'content', 'count'],
        optional: true,
        description: '"files_with_matches" (default) shows file paths, "content" shows lines, "count" shows match counts per file.',
      },
      '-n': {
        type: 'boolean',
        optional: true,
        description: 'Show line numbers. Requires output_mode: "content".',
      },
      '-i': {
        type: 'boolean',
        optional: true,
        description: 'Case insensitive search.',
      },
      '-C': {
        type: 'number',
        optional: true,
        description: 'Number of lines of context before and after match.',
      },
      head_limit: {
        type: 'number',
        optional: true,
        description: 'Limit number of results. 0 = unlimited.',
      },
    },
    required: ['pattern'],
  },
  async execute(input, cwd = process.cwd()) {
    const {
      pattern,
      path: searchPath,
      output_mode = 'files_with_matches',
      '-n': showLineNumbers = false,
      '-i': caseInsensitive = false,
      '-C': context,
      head_limit: limit,
    } = input as {
      pattern: string;
      path?: string;
      output_mode?: OutputMode;
      '-n'?: boolean;
      '-i'?: boolean;
      '-C'?: number;
      head_limit?: number;
    };

    const targetPath = searchPath
      ? path.resolve(cwd, searchPath)
      : cwd;

    // Build ripgrep arguments
    const args: string[] = ['--hidden']; // Include hidden files

    // Output mode
    if (output_mode === 'content') {
      args.push('-n'); // Always show line numbers for content
    } else if (output_mode === 'files_with_matches') {
      args.push('-l');
    } else if (output_mode === 'count') {
      args.push('-c');
    }

    // Case insensitive
    if (caseInsensitive) {
      args.push('-i');
    }

    // Context lines
    if (context !== undefined) {
      args.push(`-${context}`);
    }

    // Limit results (use --max-count for files, --maxcols for content)
    if (limit !== undefined && limit > 0) {
      if (output_mode === 'content') {
        args.push(`--max-columns=${limit}`);
      } else {
        args.push(`--max-count=${limit}`);
      }
    }

    // Pattern - use -e if it looks like a flag
    if (pattern.startsWith('-')) {
      args.push('-e', pattern);
    } else {
      args.push(pattern);
    }

    // Add target path
    args.push(targetPath);

    try {
      const result = await x('rg', args, {
        throwOnError: false,
      });

      if (result.exitCode !== 0 && result.exitCode !== 1 && result.exitCode !== 2) {
        // exitCode 1 = no matches, exitCode 2 = errors (permission denied), both are OK
        return {
          success: false,
          output: '',
          error: `grep error: ${result.stderr || result.stdout}`,
        };
      }

      const output = result.stdout.trim();

      if (!output) {
        if (output_mode === 'count') {
          return { success: true, output: 'No matches found.' };
        }
        return { success: true, output: 'No files found.' };
      }

      // Format output based on mode
      if (output_mode === 'files_with_matches') {
        const files = output.split('\n').filter(Boolean).sort();
        const count = files.length;
        const truncated = limit !== undefined && limit > 0 && files.length > limit;
        if (truncated) {
          return {
            success: true,
            output: `Found ${count} files (truncated to ${limit})\n${files.slice(0, limit).join('\n')}`,
          };
        }
        return {
          success: true,
          output: `Found ${count} files\n${output}`,
        };
      }

      if (output_mode === 'count') {
        return { success: true, output };
      }

      // content mode
      return { success: true, output };

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: '',
        error: `grep error: ${message}`,
      };
    }
  },
};
