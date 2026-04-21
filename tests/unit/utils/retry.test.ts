import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../../src/utils/retry';
import { LQiaoError, ERROR_TYPES } from '../../../src/types/error';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on MODEL_ERROR', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new LQiaoError(ERROR_TYPES.MODEL_ERROR, 'rate limited'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 2, baseDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new LQiaoError(ERROR_TYPES.TOOL_ERROR, 'bad tool'));
    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1 })).rejects.toThrow('bad tool');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should exhaust retries retries', async () => {
    const fn = vi.fn().mockRejectedValue(new LQiaoError(ERROR_TYPES.MODEL_ERROR, 'fail'));
    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
