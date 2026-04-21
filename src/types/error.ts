/** Error type identifiers */
export const ERROR_TYPES = {
  MODEL_ERROR: 'MODEL_ERROR',
  TOOL_ERROR: 'TOOL_ERROR',
  SANDBOX_VIOLATION: 'SANDBOX_VIOLATION',
  TIMEOUT: 'TIMEOUT',
  MAX_STEPS: 'MAX_STEPS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  MAX_RETRIES: 'MAX_RETRIES',
} as const;

export type ErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES];

/** Base error class for all LQiao errors */
export class LQiaoError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'LQiaoError';
  }
}
