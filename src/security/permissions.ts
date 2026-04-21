import { LQiaoError, ERROR_TYPES } from '../types/error';

/** Permission rule */
export interface PermissionRule {
  /** Rule name for debugging */
  name: string;
  /** Pattern to match (action string) */
  pattern: string;
  /** Whether this rule denies or allows the action */
  deny: boolean;
  /** Optional reason for audit logging */
  reason?: string;
}

/**
 * Permission control layer.
 * Intercepts tool actions and validates against configured rules.
 */
export class PermissionManager {
  #rules: PermissionRule[] = [];

  constructor(rules?: PermissionRule[]) {
    if (rules) {
      this.#rules = [...rules];
    }
  }

  /** Add a deny rule */
  deny(pattern: string, reason?: string): void {
    this.#rules.push({ name: `deny:${pattern}`, pattern, deny: true, reason });
  }

  /** Add an allow rule */
  allow(pattern: string): void {
    this.#rules.push({ name: `allow:${pattern}`, pattern, deny: false });
  }

  /**
   * Check if an action is permitted.
   * Returns true if allowed, throws SANDBOX_VIOLATION if denied.
   */
  check(action: string): boolean {
    for (const rule of this.#rules) {
      if (matchesPattern(action, rule.pattern)) {
        if (rule.deny) {
          throw new LQiaoError(
            ERROR_TYPES.SANDBOX_VIOLATION,
            `Action denied: ${action} (${rule.reason ?? rule.name})`,
          );
        }
        return true;
      }
    }
    // Default: allow if no rule matches
    return true;
  }

  /** Get all configured rules */
  get rules(): ReadonlyArray<PermissionRule> {
    return [...this.#rules];
  }
}

/** Simple glob matching (same as event-bus) */
function matchesPattern(value: string, pattern: string): boolean {
  if (pattern === value) return true;
  if (pattern === '**') return true;

  const regex = pattern
    .replaceAll('\\', '\\\\')
    .replaceAll('.', '\\.')
    .replaceAll('**', '\x00')
    .replaceAll('*', '[^:]*')
    .replaceAll('\x00', '.*');

  return new RegExp(`^${regex}$`).test(value);
}
