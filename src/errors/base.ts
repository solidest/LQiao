import { LQiaoError, ERROR_TYPES } from '../types/error';

export { LQiaoError, ERROR_TYPES } from '../types/error';
export type { ErrorType } from '../types/error';

/** Create a model-specific error */
export function createModelError(message: string, details?: Record<string, unknown>): LQiaoError {
  return new LQiaoError(ERROR_TYPES.MODEL_ERROR, message, details);
}

/** Create a tool-specific error */
export function createToolError(message: string, details?: Record<string, unknown>): LQiaoError {
  return new LQiaoError(ERROR_TYPES.TOOL_ERROR, message, details);
}

/** Create a sandbox-specific error */
export function createSandboxError(message: string, details?: Record<string, unknown>): LQiaoError {
  return new LQiaoError(ERROR_TYPES.SANDBOX_VIOLATION, message, details);
}

/** Create a network/API connection error */
export function createNetworkError(message: string, details?: Record<string, unknown>): NetworkError {
  return new NetworkError(message, details);
}

/** Create a rate limit error */
export function createRateLimitError(retryAfter?: number, details?: Record<string, unknown>): RateLimitError {
  return new RateLimitError(
    retryAfter != null ? `Rate limited, retry after ${retryAfter}s` : 'Rate limited',
    { retryAfter, ...details },
  );
}

/** Create a max retries exhausted error */
export function createMaxRetriesError(originalError?: Error, details?: Record<string, unknown>): MaxRetriesError {
  const message = originalError
    ? `Max retries exhausted: ${originalError.message}`
    : 'Max retries exhausted';
  return new MaxRetriesError(message, { originalError: originalError?.message, ...details });
}

/** Network/API connection failure */
export class NetworkError extends LQiaoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ERROR_TYPES.NETWORK_ERROR, message, details);
    this.name = 'NetworkError';
  }
}

/** API rate limit exceeded */
export class RateLimitError extends LQiaoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ERROR_TYPES.RATE_LIMIT_ERROR, message, details);
    this.name = 'RateLimitError';
  }
}

/** All retry attempts exhausted */
export class MaxRetriesError extends LQiaoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ERROR_TYPES.MAX_RETRIES, message, details);
    this.name = 'MaxRetriesError';
  }
}
