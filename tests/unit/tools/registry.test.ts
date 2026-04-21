import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/tools/registry';
import { ToolBase } from '../../../src/tools/base';
import type { ToolResult } from '../../../src/types/tool';

class MockTool extends ToolBase {
  name = 'mock-tool';
  description = 'A mock tool for testing';

  protected async doExecute(...args: unknown[]): Promise<ToolResult> {
    return { success: true, data: args };
  }
}

class NamedTool extends ToolBase {
  constructor(readonly toolName: string) {
    super();
  }
  name = '';
  description = 'A named tool';

  protected async doExecute(...args: unknown[]): Promise<ToolResult> {
    return { success: true, data: args };
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let tool: MockTool;

  beforeEach(() => {
    registry = new ToolRegistry();
    tool = new MockTool();
  });

  it('should register and retrieve tools', () => {
    registry.register(tool);
    expect(registry.get('mock-tool')).toBe(tool);
  });

  it('should return undefined for unknown tools', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should list all registered tools', () => {
    const t1 = new NamedTool('tool-a');
    const t2 = new NamedTool('tool-b');
    t1.name = 'tool-a';
    t2.name = 'tool-b';
    registry.register(t1);
    registry.register(t2);
    expect(registry.list()).toHaveLength(2);
  });

  it('should remove tools', () => {
    registry.register(tool);
    registry.remove('mock-tool');
    expect(registry.get('mock-tool')).toBeUndefined();
  });

  it('should track size correctly', () => {
    expect(registry.size).toBe(0);
    registry.register(tool);
    expect(registry.size).toBe(1);
    registry.remove('mock-tool');
    expect(registry.size).toBe(0);
  });

  it('should check if tools exist with has()', () => {
    expect(registry.has('mock-tool')).toBe(false);
    registry.register(tool);
    expect(registry.has('mock-tool')).toBe(true);
  });

  it('should register multiple tools at once', () => {
    const t1 = new NamedTool('tool-1');
    const t2 = new NamedTool('tool-2');
    const t3 = new NamedTool('tool-3');
    t1.name = 'tool-1';
    t2.name = 'tool-2';
    t3.name = 'tool-3';
    registry.registerAll([t1, t2, t3]);
    expect(registry.size).toBe(3);
  });
});
