import { describe, it, expect } from 'vitest';
import { evaluateBranch, type BranchRule } from '../../../src/core/branch-engine';
import type { ToolResult } from '../../../src/types/tool';

describe('BranchEngine', () => {
  describe('evaluateBranch', () => {
    it('should match equals condition', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'equals', field: 'error', value: 'file not found' },
          thenSteps: ['create the file', 'retry'],
          elseSteps: ['continue'],
        },
      ];

      const result: ToolResult = { success: false, error: 'file not found' };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(true);
      expect(decision.steps).toEqual(['create the file', 'retry']);
    });

    it('should not match equals when value differs', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'equals', field: 'error', value: 'timeout' },
          thenSteps: ['retry with timeout'],
          elseSteps: ['continue'],
        },
      ];

      const result: ToolResult = { success: false, error: 'permission denied' };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(false);
      expect(decision.steps).toEqual([]);
    });

    it('should match contains condition', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'contains', field: 'error', value: 'permission' },
          thenSteps: ['request sudo'],
          elseSteps: ['continue'],
        },
      ];

      const result: ToolResult = { success: false, error: 'permission denied' };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(true);
    });

    it('should match exists condition when field has value', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'exists', field: 'data' },
          thenSteps: ['process result'],
          elseSteps: ['log error'],
        },
      ];

      const result: ToolResult = { success: true, data: { count: 5 } };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(true);
    });

    it('should not match exists when field is null', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'exists', field: 'data' },
          thenSteps: ['process'],
          elseSteps: ['log error'],
        },
      ];

      const result: ToolResult = { success: false, error: 'not found' };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(false);
    });

    it('should match regex condition', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'regex', field: 'error', value: '^git.*failed' },
          thenSteps: ['init git repo'],
          elseSteps: ['continue'],
        },
      ];

      const result: ToolResult = { success: false, error: 'git push failed' };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(true);
    });

    it('should evaluate data.field sub-path', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'equals', field: 'data.status', value: 'empty' },
          thenSteps: ['add files first'],
          elseSteps: ['commit directly'],
        },
      ];

      const result: ToolResult = { success: true, data: { status: 'empty', files: [] } };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(true);
    });

    it('should try multiple rules in order, return first match', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'equals', field: 'error', value: 'timeout' },
          thenSteps: ['retry with timeout'],
          elseSteps: [],
        },
        {
          condition: { type: 'contains', field: 'error', value: 'not found' },
          thenSteps: ['create resource'],
          elseSteps: [],
        },
      ];

      const result: ToolResult = { success: false, error: 'resource not found' };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(true);
      expect(decision.steps).toEqual(['create resource']);
    });

    it('should return empty steps when no rules match', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'equals', field: 'error', value: 'specific' },
          thenSteps: ['handle specific'],
          elseSteps: [],
        },
      ];

      const result: ToolResult = { success: false, error: 'generic' };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(false);
      expect(decision.steps).toEqual([]);
    });

    it('should handle unknown field type gracefully', () => {
      const rules: BranchRule[] = [
        {
          condition: { type: 'contains', field: 'data', value: 'test' },
          thenSteps: ['process'],
          elseSteps: [],
        },
      ];

      // data is a number, not a string
      const result: ToolResult = { success: true, data: 42 };
      const decision = evaluateBranch(rules, result);

      expect(decision.matched).toBe(false);
    });
  });
});
