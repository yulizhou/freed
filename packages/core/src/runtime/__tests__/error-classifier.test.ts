import { describe, it, expect } from 'vitest';
import {
  classifyError,
  shouldRetry,
  backoffDelay,
  withRetry,
} from '../error-classifier.js';

describe('classifyError', () => {
  it('classifies timeout errors', () => {
    expect(classifyError(new Error('Connection timed out'))).toBe('timeout');
    expect(classifyError(new Error('ETIMEDOUT'))).toBe('timeout');
    expect(classifyError(new Error('Request aborted'))).toBe('timeout');
    expect(classifyError(new Error('Request timeout'))).toBe('timeout');
  });

  it('classifies abort errors as timeout', () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    expect(classifyError(err)).toBe('timeout');
  });

  it('classifies network errors as transient', () => {
    expect(classifyError(new Error('ECONNRESET'))).toBe('transient');
    expect(classifyError(new Error('ECONNREFUSED'))).toBe('transient');
    expect(classifyError(new Error('socket hang up'))).toBe('transient');
    expect(classifyError(new Error('Network error'))).toBe('transient');
  });

  it('classifies rate limit errors as transient', () => {
    expect(classifyError(new Error('429 Too Many Requests'))).toBe('transient');
    expect(classifyError(new Error('Rate limit exceeded'))).toBe('transient');
    expect(classifyError(new Error('Quota exceeded'))).toBe('transient');
  });

  it('classifies 5xx errors as transient', () => {
    expect(classifyError(new Error('500 Internal Server Error'))).toBe('transient');
    expect(classifyError(new Error('502 Bad Gateway'))).toBe('transient');
    expect(classifyError(new Error('503 Service Unavailable'))).toBe('transient');
    expect(classifyError(new Error('504 Gateway Timeout'))).toBe('transient');
  });

  it('classifies auth errors as permanent', () => {
    expect(classifyError(new Error('401 Unauthorized'))).toBe('permanent');
    expect(classifyError(new Error('403 Forbidden'))).toBe('permanent');
    expect(classifyError(new Error('Invalid API key'))).toBe('permanent');
    expect(classifyError(new Error('Authentication failed'))).toBe('permanent');
  });

  it('classifies validation errors as permanent', () => {
    expect(classifyError(new Error('400 Bad Request'))).toBe('permanent');
    expect(classifyError(new Error('Validation error'))).toBe('permanent');
    expect(classifyError(new Error('Not found: 404'))).toBe('permanent');
  });

  it('defaults to permanent for unknown errors', () => {
    expect(classifyError(new Error('Some unknown error'))).toBe('permanent');
  });

  it('handles non-Error inputs', () => {
    expect(classifyError('something went wrong')).toBe('permanent');
    expect(classifyError(42)).toBe('permanent');
    expect(classifyError(null)).toBe('permanent');
  });
});

describe('shouldRetry', () => {
  it('returns true for transient errors under max', () => {
    expect(shouldRetry(new Error('ECONNRESET'), 0, 2)).toBe(true);
  });

  it('returns true for timeout errors under max', () => {
    expect(shouldRetry(new Error('timeout'), 0, 2)).toBe(true);
  });

  it('returns false for permanent errors', () => {
    expect(shouldRetry(new Error('401 Unauthorized'), 0, 2)).toBe(false);
  });

  it('returns false when max retries reached', () => {
    expect(shouldRetry(new Error('ECONNRESET'), 2, 2)).toBe(false);
    expect(shouldRetry(new Error('timeout'), 3, 3)).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('returns base delay for attempt 0', () => {
    expect(backoffDelay(0, 1000)).toBe(1000);
  });

  it('exponential growth', () => {
    expect(backoffDelay(1, 1000)).toBe(2000);
    expect(backoffDelay(2, 1000)).toBe(4000);
    expect(backoffDelay(3, 1000)).toBe(8000);
  });

  it('caps at max delay', () => {
    expect(backoffDelay(10, 1000, 30_000)).toBe(30_000);
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const result = await withRetry(async () => 'success');
    expect(result).toBe('success');
  });

  it('retries on transient errors', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('ECONNRESET');
        return 'recovered';
      },
      { maxRetries: 2, baseDelayMs: 10 },
    );
    expect(result).toBe('recovered');
    expect(attempts).toBe(2);
  });

  it('does not retry on permanent errors', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('401 Unauthorized');
        },
        { maxRetries: 2, baseDelayMs: 10 },
      ),
    ).rejects.toThrow('401 Unauthorized');
    expect(attempts).toBe(1);
  });

  it('gives up after max retries', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('ECONNRESET');
        },
        { maxRetries: 2, baseDelayMs: 10 },
      ),
    ).rejects.toThrow('ECONNRESET');
    expect(attempts).toBe(3); // initial + 2 retries
  });
});
