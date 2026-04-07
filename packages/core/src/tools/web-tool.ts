import type { AnyToolDefinition } from './types.js';

export const webFetchTool: AnyToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch content from a URL',
  riskLevel: 'ask',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch content from',
      },
      prompt: {
        type: 'string',
        description: 'Optional prompt describing what to extract from the fetched content',
        optional: true,
      },
    },
    required: ['url'],
  },
  async execute(input, _cwd = process.cwd()) {
    const { url, prompt } = input as { url: string; prompt?: string };

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          success: false,
          output: '',
          error: `Invalid URL protocol: ${parsedUrl.protocol}. Only http and https are supported.`,
        };
      }
    } catch {
      return {
        success: false,
        output: '',
        error: `Invalid URL: ${url}`,
      };
    }

    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Freed/1.0)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          output: '',
          error: `HTTP error ${response.status}: ${response.statusText}`,
        };
      }

      const content = await response.text();

      // If a prompt is provided, include it in the output metadata
      if (prompt) {
        return {
          success: true,
          output: `[Prompt: ${prompt}]\n${content}`,
        };
      }

      return {
        success: true,
        output: content,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Fetch failed: ${error.message}`,
      };
    }
  },
};
