import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../model-router.js';
import { FreedError } from '@freed/shared';

describe('ModelRouter', () => {
  describe('isValidModelId', () => {
    it('should accept valid model identifiers', () => {
      expect(ModelRouter.isValidModelId('anthropic/claude-opus-4-5')).toBe(true);
      expect(ModelRouter.isValidModelId('openai/gpt-4o')).toBe(true);
      expect(ModelRouter.isValidModelId('google/gemini-pro')).toBe(true);
    });

    it('should reject identifiers without a slash', () => {
      expect(ModelRouter.isValidModelId('gpt-4')).toBe(false);
      expect(ModelRouter.isValidModelId('')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should throw FreedError for unknown provider', () => {
      const router = new ModelRouter();
      expect(() => router.resolve('unknown/model')).toThrowError(FreedError);
    });

    it('should throw FreedError for missing slash', () => {
      const router = new ModelRouter();
      expect(() => router.resolve('anthropic')).toThrowError(FreedError);
    });

    it('should resolve an anthropic model without throwing', () => {
      const router = new ModelRouter({ apiKeys: { anthropic: 'test-key' } });
      // just checks it returns something – real call would require network
      expect(() => router.resolve('anthropic/claude-haiku-20240307')).not.toThrow();
    });

    it('should resolve an openai model without throwing', () => {
      const router = new ModelRouter({ apiKeys: { openai: 'test-key' } });
      expect(() => router.resolve('openai/gpt-4o-mini')).not.toThrow();
    });

    it('should resolve a google model without throwing', () => {
      const router = new ModelRouter({ apiKeys: { google: 'test-key' } });
      expect(() => router.resolve('google/gemini-1.5-flash')).not.toThrow();
    });
  });
});
