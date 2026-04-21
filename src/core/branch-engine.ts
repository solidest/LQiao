import type { ToolResult } from '../types/tool';

/** Condition type for branch evaluation */
export interface Condition {
  type: 'equals' | 'contains' | 'exists' | 'regex';
  /** Field to inspect on the tool result: 'data', 'error', or 'data.<key>' */
  field: string;
  value?: string;
}

/** Branch rule — maps condition to step lists */
export interface BranchRule {
  condition: Condition;
  thenSteps: string[];
  elseSteps: string[];
}

/** Evaluated branch decision */
export interface BranchDecision {
  matched: boolean;
  steps: string[];
}

/** Resolve a field path against a tool result */
function resolveField(result: ToolResult, field: string): unknown {
  if (field === 'data') return result.data;
  if (field === 'error') return result.error;
  if (field.startsWith('data.')) {
    const key = field.slice(5);
    if (typeof result.data === 'object' && result.data !== null && !Array.isArray(result.data)) {
      return (result.data as Record<string, unknown>)[key];
    }
    return undefined;
  }
  return undefined;
}

/** Evaluate a single condition against a tool result */
function evaluateCondition(result: ToolResult, condition: Condition): boolean {
  const value = resolveField(result, condition.field);

  switch (condition.type) {
    case 'exists':
      return value !== undefined && value !== null && value !== '';
    case 'equals':
      return String(value) === condition.value;
    case 'contains':
      return typeof value === 'string' && value.includes(condition.value ?? '');
    case 'regex':
      if (typeof value !== 'string' || !condition.value) return false;
      return new RegExp(condition.value).test(value);
    default:
      return false;
  }
}

/** Evaluate branch rules against a tool result, return the first matching decision */
export function evaluateBranch(
  rules: BranchRule[],
  result: ToolResult,
): BranchDecision {
  for (const rule of rules) {
    const matched = evaluateCondition(result, rule.condition);
    if (matched) {
      return { matched: true, steps: rule.thenSteps };
    }
  }
  return { matched: false, steps: rules[0]?.elseSteps ?? [] };
}
