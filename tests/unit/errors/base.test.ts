import { describe, it, expect } from 'vitest';
import {
  LQiaoError,
  ERROR_TYPES,
  createModelError,
  createToolError,
  createSandboxError,
  createNetworkError,
  createRateLimitError,
  createMaxRetriesError,
  NetworkError,
  RateLimitError,
  MaxRetriesError,
} from '../../../src/errors/base';

describe('ERROR_TYPES', () => {
  it('should have all expected error types', () => {
    expect(ERROR_TYPES.MODEL_ERROR).toBe('MODEL_ERROR');
    expect(ERROR_TYPES.TOOL_ERROR).toBe('TOOL_ERROR');
    expect(ERROR_TYPES.SANDBOX_VIOLATION).toBe('SANDBOX_VIOLATION');
    expect(ERROR_TYPES.TIMEOUT).toBe('TIMEOUT');
    expect(ERROR_TYPES.MAX_STEPS).toBe('MAX_STEPS');
    expect(ERROR_TYPES.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ERROR_TYPES.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR');
    expect(ERROR_TYPES.MAX_RETRIES).toBe('MAX_RETRIES');
  });
});

describe('LQiaoError', () => {
  it('should create with type and message', () => {
    const err = new LQiaoError(ERROR_TYPES.MODEL_ERROR, 'API failed');
    expect(err.type).toBe('MODEL_ERROR');
    expect(err.message).toBe('API failed');
    expect(err).toBeInstanceOf(Error);
  });

  it('should preserve details', () => {
    const err = new LQiaoError(ERROR_TYPES.TOOL_ERROR, 'Tool failed', { tool: 'git' });
    expect(err.details).toEqual({ tool: 'git' });
  });
});

describe('createModelError', () => {
  it('should create MODEL_ERROR type', () => {
    const err = createModelError('API timeout');
    expect(err.type).toBe(ERROR_TYPES.MODEL_ERROR);
    expect(err).toBeInstanceOf(LQiaoError);
  });
});

describe('createToolError', () => {
  it('should create TOOL_ERROR type', () => {
    const err = createToolError('Tool crashed');
    expect(err.type).toBe(ERROR_TYPES.TOOL_ERROR);
  });
});

describe('createSandboxError', () => {
  it('should create SANDBOX_VIOLATION type', () => {
    const err = createSandboxError('Path escaped');
    expect(err.type).toBe(ERROR_TYPES.SANDBOX_VIOLATION);
  });
});

describe('createNetworkError', () => {
  it('should create NETWORK_ERROR type', () => {
    const err = createNetworkError('Connection refused');
    expect(err.type).toBe(ERROR_TYPES.NETWORK_ERROR);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.name).toBe('NetworkError');
  });

  it('should preserve details', () => {
    const err = createNetworkError('ECONNREFUSED', { host: 'localhost' });
    expect(err.details).toEqual({ host: 'localhost' });
  });
});

describe('createRateLimitError', () => {
  it('should create RATE_LIMIT_ERROR type', () => {
    const err = createRateLimitError(60);
    expect(err.type).toBe(ERROR_TYPES.RATE_LIMIT_ERROR);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.message).toContain('60');
  });

  it('should work without retryAfter', () => {
    const err = createRateLimitError();
    expect(err.type).toBe(ERROR_TYPES.RATE_LIMIT_ERROR);
    expect(err.message).toBe('Rate limited');
  });
});

describe('createMaxRetriesError', () => {
  it('should create MAX_RETRIES type', () => {
    const err = createMaxRetriesError();
    expect(err.type).toBe(ERROR_TYPES.MAX_RETRIES);
    expect(err).toBeInstanceOf(MaxRetriesError);
    expect(err.name).toBe('MaxRetriesError');
  });

  it('should include original error message', () => {
    const original = new Error('API down');
    const err = createMaxRetriesError(original);
    expect(err.message).toContain('API down');
    expect(err.details?.originalError).toBe('API down');
  });
});
