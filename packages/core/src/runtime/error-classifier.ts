/**
 * Error classification categories for retry/fallback decisions.
 */
export type ErrorCategory = 'transient' | 'permanent' | 'timeout';

/**
 * Classifies an error into transient, permanent, or timeout categories.
 *
 * Transient errors are safe to retry (network flaps, rate limits, 5xx).
 * Timeout errors may succeed with a longer timeout or after a delay.
 * Permanent errors should not be retried (4xx auth, validation, not found).
 */
export function classifyError(err: unknown): ErrorCategory {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  const lower = message.toLowerCase();

  // Permanent errors (do not retry)
  // Auth, validation, not found, payment required
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('400') ||
    lower.includes('404') ||
    lower.includes('402') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('not found') ||
    lower.includes('invalid') ||
    lower.includes('validation') ||
    lower.includes('permission') ||
    lower.includes('access denied') ||
    lower.includes('api key') ||
    lower.includes('authentication') ||
    lower.includes('insufficient_quota') ||
    lower.includes('billing')
  ) {
    return 'permanent';
  }

  // Server errors (5xx) — checked before timeout substring
  // to ensure "504 Gateway Timeout" is transient not timeout
  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('server error') ||
    lower.includes('internal error') ||
    lower.includes('service unavailable') ||
    lower.includes('overloaded')
  ) {
    return 'transient';
  }

  // Timeout indicators
  if (
    name === 'AbortError' ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('etimedout') ||
    lower.includes('aborted')
  ) {
    return 'timeout';
  }

  // Transient indicators (safe to retry)
  // Network errors, rate limits, server errors
  if (
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('econnaborted') ||
    lower.includes('epipe') ||
    lower.includes('enetunreach') ||
    lower.includes('eai_again') ||
    lower.includes('enotfound') ||
    lower.includes('socket hang up') ||
    lower.includes('network') ||
    lower.includes('dns') ||
    name === 'FetchError' ||
    name === 'NetworkError'
  ) {
    return 'transient';
  }

  // Rate limiting
  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('quota')
  ) {
    return 'transient';
  }

  // Default: treat unknown errors as permanent (safety)
  return 'permanent';
}

/**
 * Determine if a retry should be attempted based on error category and retry count.
 */
export function shouldRetry(
  err: unknown,
  attempt: number,
  maxRetries: number,
): boolean {
  if (attempt >= maxRetries) return false;
  const category = classifyError(err);
  return category === 'transient' || category === 'timeout';
}

/**
 * Calculate exponential backoff delay in milliseconds.
 * Formula: baseDelay * 2^attempt, capped at maxDelay.
 */
export function backoffDelay(
  attempt: number,
  baseDelayMs = 1000,
  maxDelayMs = 30_000,
): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}

/**
 * Execute a function with retry logic for transient errors.
 *
 * Retries on transient and timeout errors with exponential backoff.
 * Does not retry on permanent errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!shouldRetry(err, attempt, maxRetries)) {
        throw err;
      }
      const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
