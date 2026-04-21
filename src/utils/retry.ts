import { ERROR_TYPES, LQiaoError } from '../types/error';
import { createMaxRetriesError } from '../errors/base';

export interface RetryOptions {
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Base delay in milliseconds */
  baseDelay?: number;
  /** Maximum delay in milliseconds (caps exponential backoff) */
  maxDelay?: number;
}

const DEFAULTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 30000,
};

/**
 * Execute a function with exponential backoff retry.
 * Only retries on transient errors (MODEL_ERROR, TIMEOUT, NETWORK_ERROR, RATE_LIMIT_ERROR).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay } = { ...DEFAULTS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryable(lastError) || attempt === maxRetries) {
        if (attempt === maxRetries) {
          throw createMaxRetriesError(lastError);
        }
        throw lastError;
      }
      const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
      await sleep(delay);
    }
  }

  throw lastError!;
}

function isRetryable(error: Error): boolean {
  if (error instanceof LQiaoError) {
    return (
      error.type === ERROR_TYPES.MODEL_ERROR ||
      error.type === ERROR_TYPES.TIMEOUT ||
      error.type === ERROR_TYPES.NETWORK_ERROR ||
      error.type === ERROR_TYPES.RATE_LIMIT_ERROR
    );
  }
  // Network errors are generally retryable
  return (
    'code' in error &&
    (error as { code: string }).code === 'ECONNRESET'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
