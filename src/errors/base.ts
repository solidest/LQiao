import { LQiaoError, ERROR_TYPES } from '../types/error';

export { LQiaoError, ERROR_TYPES } from '../types/error';
export type { ErrorType } from '../types/error';

/** Create a model-specific error */
export function createModelError(message: string, details?: Record<string, unknown>): LQiaoError {
  return new LQiaoError('MODEL_ERROR' as const, message, details);
}

/** Create a tool-specific error */
export function createToolError(message: string, details?: Record<string, unknown>): LQiaoError {
  return new LQiaoError('TOOL_ERROR' as const, message, details);
}

/** Create a sandbox-specific error */
export function createSandboxError(message: string, details?: Record<string, unknown>): LQiaoError {
  return new LQiaoError('SANDBOX_VIOLATION' as const, message, details);
}
