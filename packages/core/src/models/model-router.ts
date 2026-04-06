import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { FreedError, ErrorCode } from '../shared/index.js';

export interface ModelRouterOptions {
  apiKeys?: {
    anthropic?: string;
    openai?: string;
    google?: string;
    deepseek?: string;
    openrouter?: string;
  };
  baseUrls?: {
    openai?: string;
  };
}

/**
 * Routes model identifiers in the format "provider/model-name" to the
 * corresponding AI SDK LanguageModel instance.
 *
 * Supported prefixes:
 *   anthropic/   →  @ai-sdk/anthropic
 *   openai/      →  @ai-sdk/openai
 *   google/      →  @ai-sdk/google
 *   deepseek/    →  @ai-sdk/openai (OpenAI-compatible)
 *   openrouter/  →  @ai-sdk/openai (OpenAI-compatible, baseURL: openrouter.ai)
 */
export class ModelRouter {
  private readonly opts: ModelRouterOptions;

  constructor(opts: ModelRouterOptions = {}) {
    this.opts = opts;
  }

  resolve(modelId: string): LanguageModel {
    const slashIdx = modelId.indexOf('/');
    if (slashIdx === -1) {
      throw new FreedError(
        ErrorCode.MODEL_ERROR,
        `Invalid model identifier "${modelId}". Expected format: "provider/model-name"`,
      );
    }

    const provider = modelId.slice(0, slashIdx);
    const model = modelId.slice(slashIdx + 1);

    switch (provider) {
      case 'anthropic': {
        const apiKey = this.opts.apiKeys?.anthropic ?? process.env['ANTHROPIC_API_KEY'];
        const anthropic = createAnthropic(apiKey ? { apiKey } : {});
        return anthropic(model);
      }

      case 'openai': {
        const apiKey = this.opts.apiKeys?.openai ?? process.env['OPENAI_API_KEY'];
        const baseURL = this.opts.baseUrls?.openai;
        const openai = createOpenAI({
          ...(apiKey ? { apiKey } : {}),
          ...(baseURL ? { baseURL } : {}),
        });
        return openai(model);
      }

      case 'google': {
        const apiKey = this.opts.apiKeys?.google ?? process.env['GOOGLE_API_KEY'];
        const google = createGoogleGenerativeAI(apiKey ? { apiKey } : {});
        return google(model);
      }

      case 'deepseek': {
        // DeepSeek is OpenAI-compatible; MODEL_KEY is the conventional env var
        const apiKey =
          this.opts.apiKeys?.deepseek ??
          process.env['DEEPSEEK_API_KEY'] ??
          process.env['MODEL_KEY'];
        const deepseek = createOpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          ...(apiKey ? { apiKey } : {}),
        });
        return deepseek(model);
      }

      case 'openrouter': {
        const apiKey = this.opts.apiKeys?.openrouter ?? process.env['OPENROUTER_API_KEY'];
        const openrouter = createOpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          ...(apiKey ? { apiKey } : {}),
        });
        return openrouter(model);
      }

      default:
        throw new FreedError(ErrorCode.MODEL_ERROR, `Unknown model provider "${provider}"`);
    }
  }

  /**
   * Returns true if the model identifier looks well-formed.
   */
  static isValidModelId(modelId: string): boolean {
    return /^[a-z]+\/.+$/.test(modelId);
  }
}
