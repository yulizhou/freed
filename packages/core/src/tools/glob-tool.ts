import fg from 'fast-glob';
import path from 'node:path';
import type { AnyToolDefinition } from './types.js';

/**
 * GlobTool - Find files matching a glob pattern.
 *
 * Simplified from cc-tools/GlobTool:
 * - No UI layer (CLI-appropriate output)
 * - No permission system
 * - No analytics
 * - No staleness checks
 * - Minimal: just pattern matching with fast-glob
 */
export const globTool: AnyToolDefinition = {
  name: 'glob',
  description:
    'Find files and directories matching a glob pattern. Use patterns like "**/*.ts" to search recursively or "*.json" for flat matches. Returns a list of matching file paths.',
  riskLevel: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description:
          'The glob pattern to match files against. Examples: "**/*.ts", "src/**/*.js", "*.json"',
      },
      path: {
        type: 'string',
        description:
          'The directory to search in. Defaults to current working directory.',
        optional: true,
      },
    },
    required: ['pattern'],
  },
  async execute(input, cwd = process.cwd()) {
    const { pattern, path: searchPath } = input as {
      pattern: string;
      path?: string;
    };

    const baseDir = searchPath
      ? path.resolve(cwd, searchPath)
      : cwd;

    try {
      const files = await fg(/** @type {string} */ (pattern), {
        cwd: baseDir,
        absolute: false,
        onlyFiles: true,
        onlyDirectories: false,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });

      // Sort for deterministic output
      files.sort();

      if (files.length === 0) {
        return {
          success: true,
          output: 'No files found matching the pattern.',
        };
      }

      return {
        success: true,
        output: files.join('\n'),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: '',
        error: `Glob error: ${message}`,
      };
    }
  },
};
