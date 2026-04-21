import { describe, it, expect } from 'vitest';
import { matchesPattern } from '../../../src/utils/glob';

describe('matchesPattern', () => {
  it('should match exact strings', () => {
    expect(matchesPattern('hello', 'hello')).toBe(true);
    expect(matchesPattern('hello', 'world')).toBe(false);
  });

  it('should match ** to everything', () => {
    expect(matchesPattern('anything', '**')).toBe(true);
    expect(matchesPattern('a:b:c', '**')).toBe(true);
  });

  it('should match * within a single segment', () => {
    expect(matchesPattern('onStep', 'on*')).toBe(true);
    expect(matchesPattern('onToolCall', 'on*Call')).toBe(true);
    expect(matchesPattern('onError', '*Error')).toBe(true);
  });

  it('should not have * match across colon separators', () => {
    expect(matchesPattern('a:b', '*')).toBe(false);
    expect(matchesPattern('a:b:c', '*')).toBe(false);
    expect(matchesPattern('a', '*')).toBe(true);
  });

  it('should match ** across multiple segments', () => {
    expect(matchesPattern('agent:beforeRun', '**:beforeRun')).toBe(true);
    expect(matchesPattern('deep:nested:value', 'deep:**')).toBe(true);
  });

  it('should handle escaped dots', () => {
    expect(matchesPattern('foo.bar', 'foo.bar')).toBe(true);
    expect(matchesPattern('fooXbar', 'foo.bar')).toBe(false);
  });
});
