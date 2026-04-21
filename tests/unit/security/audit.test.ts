import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLog } from '../../../src/security/audit';

describe('AuditLog', () => {
  let log: AuditLog;

  beforeEach(() => {
    log = new AuditLog();
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
});
