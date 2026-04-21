import { describe, it, expect, beforeEach } from 'vitest';
import { Profiler } from '../../../src/logger/profiler';

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler();
  });

  it('should record timing for operations', () => {
    profiler.start('model-call');
    profiler.stop('model-call');
    const records = profiler.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('model-call');
    expect(records[0].duration).toBeGreaterThanOrEqual(0);
  });

  it('should return null for unknown stop', () => {
    expect(profiler.stop('nonexistent')).toBeNull();
  });

  it('should calculate averages', () => {
    for (let i = 0; i < 3; i++) {
      profiler.start('test');
      profiler.stop('test');
    }
    const avg = profiler.average('test');
    expect(avg).not.toBeNull();
    expect(avg!).toBeGreaterThanOrEqual(0);
  });

  it('should return null average for unknown operation', () => {
    expect(profiler.average('unknown')).toBeNull();
  });

  it('should calculate max', () => {
    profiler.start('a');
    profiler.stop('a');
    profiler.start('a');
    profiler.stop('a');
    const max = profiler.max('a');
    expect(max).not.toBeNull();
    expect(max!).toBeGreaterThanOrEqual(0);
  });

  it('should clear all records', () => {
    profiler.start('x');
    profiler.stop('x');
    profiler.clear();
    expect(profiler.getRecords()).toHaveLength(0);
  });
});
