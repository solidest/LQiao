import { describe, it, expect } from 'vitest';
import { PermissionManager } from '../../../src/security/permissions';
import { LQiaoError, ERROR_TYPES } from '../../../src/types/error';

describe('PermissionManager', () => {
  it('should allow actions by default (no rules)', () => {
    const pm = new PermissionManager();
    expect(pm.check('any-action')).toBe(true);
  });

  it('should deny actions matching deny rules', () => {
    const pm = new PermissionManager();
    pm.deny('git:push');
    expect(() => pm.check('git:push')).toThrow(LQiaoError);
  });

  it('should include reason in denial error', () => {
    const pm = new PermissionManager();
    pm.deny('file:delete', 'Cannot delete production files');
    try {
      pm.check('file:delete');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LQiaoError);
      expect((e as LQiaoError).message).toContain('Cannot delete production files');
    }
  });

  it('should allow actions matching allow rules', () => {
    const pm = new PermissionManager();
    pm.allow('git:add');
    expect(pm.check('git:add')).toBe(true);
  });

  it('should support wildcard patterns', () => {
    const pm = new PermissionManager();
    pm.deny('file:delete*');
    expect(() => pm.check('file:delete-all')).toThrow(LQiaoError);
    expect(pm.check('file:read')).toBe(true);
  });

  it('should expose rules', () => {
    const pm = new PermissionManager();
    pm.deny('test');
    expect(pm.rules).toHaveLength(1);
    expect(pm.rules[0].deny).toBe(true);
    expect(pm.rules[0].pattern).toBe('test');
  });
});
