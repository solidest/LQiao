import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLog } from '../../../src/security/audit';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TEST_FILE = join(process.cwd(), '.test-audit.json');

describe('AuditLog', () => {
  let log: AuditLog;

  beforeEach(() => {
    log = new AuditLog();
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('should record entries', () => {
    log.record({ tool: 'file', action: 'read', args: { path: 'test.txt' }, success: true, duration: 5 });
    expect(log.size).toBe(1);
  });

  it('should add timestamps automatically', () => {
    log.record({ tool: 'git', action: 'commit', args: {}, success: true, duration: 100 });
    const entries = log.getEntries();
    expect(entries[0].timestamp).toBeGreaterThan(0);
  });

  it('should filter by tool', () => {
    log.record({ tool: 'file', action: 'read', args: {}, success: true, duration: 1 });
    log.record({ tool: 'git', action: 'push', args: {}, success: true, duration: 2 });
    const fileEntries = log.filterByTool('file');
    expect(fileEntries).toHaveLength(1);
    expect(fileEntries[0].tool).toBe('file');
  });

  it('should filter by success', () => {
    log.record({ tool: 'file', action: 'read', args: {}, success: true, duration: 1 });
    log.record({ tool: 'file', action: 'delete', args: {}, success: false, duration: 1, error: 'blocked' });
    expect(log.filterBySuccess(true)).toHaveLength(1);
    expect(log.filterBySuccess(false)).toHaveLength(1);
  });

  it('should export to JSON', () => {
    log.record({ tool: 'test', action: 'x', args: {}, success: true, duration: 0 });
    const json = log.toJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should clear entries', () => {
    log.record({ tool: 'test', action: 'x', args: {}, success: true, duration: 0 });
    log.clear();
    expect(log.size).toBe(0);
  });

  describe('filterByTimeRange', () => {
    it('should filter entries within time range', () => {
      const base = Date.now();
      log.record({ tool: 'a', action: 'x', args: {}, success: true, duration: 1 });
      log.record({ tool: 'b', action: 'y', args: {}, success: true, duration: 2 });
      log.record({ tool: 'c', action: 'z', args: {}, success: true, duration: 3 });

      const entries = log.getEntries();
      // All entries have same timestamp, so filtering by that timestamp returns all 3
      const filtered = log.filterByTimeRange(entries[0].timestamp, entries[0].timestamp);
      expect(filtered).toHaveLength(3);

      // Filtering by a range that includes all
      const filtered2 = log.filterByTimeRange(0, Number.MAX_SAFE_INTEGER);
      expect(filtered2).toHaveLength(3);
    });

    it('should return empty when range has no entries', () => {
      log.record({ tool: 'a', action: 'x', args: {}, success: true, duration: 1 });
      const filtered = log.filterByTimeRange(0, 1);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('getSummary', () => {
    it('should return zero summary for empty log', () => {
      const summary = log.getSummary();
      expect(summary.totalCalls).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.avgDuration).toBe(0);
      expect(summary.topErrors).toEqual([]);
    });

    it('should compute success rate and average duration', () => {
      log.record({ tool: 'file', action: 'read', args: {}, success: true, duration: 10 });
      log.record({ tool: 'git', action: 'push', args: {}, success: false, duration: 20, error: 'timeout' });
      log.record({ tool: 'file', action: 'write', args: {}, success: true, duration: 30 });

      const summary = log.getSummary();
      expect(summary.totalCalls).toBe(3);
      expect(summary.successRate).toBeCloseTo(2 / 3, 5);
      expect(summary.avgDuration).toBe(20);
    });

    it('should aggregate top errors', () => {
      log.record({ tool: 'file', action: 'read', args: {}, success: false, duration: 1, error: 'EACCES' });
      log.record({ tool: 'file', action: 'write', args: {}, success: false, duration: 1, error: 'EACCES' });
      log.record({ tool: 'file', action: 'read', args: {}, success: false, duration: 1, error: 'timeout' });

      const summary = log.getSummary();
      expect(summary.topErrors).toHaveLength(2);
      expect(summary.topErrors[0].count).toBe(2);
      expect(summary.topErrors[0].error).toBe('EACCES');
    });
  });

  describe('persistence', () => {
    it('should save and load entries', async () => {
      log.record({ tool: 'file', action: 'read', args: { path: '/tmp/x' }, success: true, duration: 5 });

      await log.saveToFile(TEST_FILE);

      const log2 = new AuditLog();
      await log2.loadFromFile(TEST_FILE);

      expect(log2.size).toBe(1);
      expect(log2.getEntries()[0].tool).toBe('file');
    });
  });
});
