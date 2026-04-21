import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/tools/registry';

function createTool(name: string, extra?: Partial<{ name: string; description: string }>) {
  return {
    name,
    description: `Tool ${name}`,
    execute: vi.fn().mockResolvedValue({ success: true, data: 'ok' }),
    ...extra,
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register a tool', () => {
    const tool = createTool('test');
    registry.register(tool);

    expect(registry.has('test')).toBe(true);
    expect(registry.get('test')).toBe(tool);
  });

  it('should register multiple tools', () => {
    registry.registerAll([createTool('a'), createTool('b'), createTool('c')]);

    expect(registry.size).toBe(3);
  });

  it('should remove a tool', () => {
    registry.register(createTool('test'));
    registry.remove('test');

    expect(registry.has('test')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('should list all tools', () => {
    const a = createTool('a');
    const b = createTool('b');
    registry.registerAll([a, b]);

    const tools = registry.list();

    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toContain('a');
    expect(tools.map((t) => t.name)).toContain('b');
  });

  it('should replace an existing tool and return the old one', () => {
    const oldTool = createTool('test');
    registry.register(oldTool);

    const newTool = createTool('test', { description: 'New version' });
    const returned = registry.replace('test', newTool);

    expect(returned).toBe(oldTool);
    expect(registry.get('test')?.description).toBe('New version');
  });

  it('should replace a non-existent tool without error', () => {
    const newTool = createTool('new');
    const returned = registry.replace('new', newTool);

    expect(returned).toBeUndefined();
    expect(registry.has('new')).toBe(true);
  });

  it('should call onRegistered callback when registering', () => {
    const callback = vi.fn();
    const reg = new ToolRegistry({ onRegistered: callback });
    const tool = createTool('test');

    reg.register(tool);

    expect(callback).toHaveBeenCalledWith(tool);
  });

  it('should call onRegistered callback when replacing', () => {
    const callback = vi.fn();
    const reg = new ToolRegistry({ onRegistered: callback });

    reg.register(createTool('test'));
    vi.clearAllMocks();

    reg.replace('test', createTool('test'));

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
