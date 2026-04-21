import { describe, it, expect, vi, beforeEach } from 'vitest';

function createEventBusSpies() {
  return { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn() };
}

import { SkillRegistry } from '../../../src/core/skill-registry';

function createSkill(name: string) {
  return {
    name,
    description: `Description for ${name}`,
    prompt: `Prompt for ${name}`,
    enabled: true,
  };
}

describe('SkillRegistry', () => {
  let eventBus: ReturnType<typeof createEventBusSpies>;
  let registry: SkillRegistry;

  beforeEach(() => {
    eventBus = createEventBusSpies();
    registry = new SkillRegistry(eventBus as unknown as typeof eventBus);
  });

  it('should register a skill', () => {
    registry.register(createSkill('test'));

    expect(registry.get('test')).toBeDefined();
    expect(registry.get('test')?.name).toBe('test');
  });

  it('should throw when registering duplicate skill', () => {
    registry.register(createSkill('test'));

    expect(() => registry.register(createSkill('test'))).toThrow(
      'Skill "test" is already registered',
    );
  });

  it('should emit onSkillLoaded event', () => {
    registry.register(createSkill('test'));

    expect(eventBus.emit).toHaveBeenCalledWith('onSkillLoaded', { name: 'test' });
  });

  it('should enable a disabled skill', () => {
    registry.register({ ...createSkill('test'), enabled: false });

    expect(registry.get('test')?.enabled).toBe(false);
    registry.enable('test');

    expect(registry.get('test')?.enabled).toBe(true);
    expect(eventBus.emit).toHaveBeenCalledWith('onSkillEnabled', { name: 'test' });
  });

  it('should throw when enabling unregistered skill', () => {
    expect(() => registry.enable('nonexistent')).toThrow(
      'Skill "nonexistent" is not registered',
    );
  });

  it('should not emit event when enabling already-enabled skill', () => {
    registry.register(createSkill('test'));
    vi.clearAllMocks();

    registry.enable('test');

    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('should disable an enabled skill', () => {
    registry.register(createSkill('test'));

    registry.disable('test');

    expect(registry.get('test')?.enabled).toBe(false);
    expect(eventBus.emit).toHaveBeenCalledWith('onSkillDisabled', { name: 'test' });
  });

  it('should throw when disabling unregistered skill', () => {
    expect(() => registry.disable('nonexistent')).toThrow(
      'Skill "nonexistent" is not registered',
    );
  });

  it('should remove a skill', () => {
    registry.register(createSkill('test'));
    registry.remove('test');

    expect(registry.get('test')).toBeUndefined();
  });

  it('should list all registered skills', () => {
    registry.register(createSkill('a'));
    registry.register(createSkill('b'));

    const skills = registry.list();

    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name)).toContain('a');
    expect(skills.map((s) => s.name)).toContain('b');
  });

  it('should get tools from all enabled skills', () => {
    const toolA = { name: 'tool-a', description: 'desc', execute: vi.fn() };
    const toolB = { name: 'tool-b', description: 'desc', execute: vi.fn() };

    registry.register({ ...createSkill('a'), tools: [toolA] });
    registry.register({ ...createSkill('b'), tools: [toolB] });

    const tools = registry.getEnabledTools();

    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toContain('tool-a');
    expect(tools.map((t) => t.name)).toContain('tool-b');
  });

  it('should only return tools from enabled skills', () => {
    const toolA = { name: 'tool-a', description: 'desc', execute: vi.fn() };
    const toolB = { name: 'tool-b', description: 'desc', execute: vi.fn() };

    registry.register({ ...createSkill('a'), tools: [toolA] });
    registry.register({ ...createSkill('b'), tools: [toolB], enabled: false });

    const tools = registry.getEnabledTools();

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('tool-a');
  });

  it('should get concatenated prompts from enabled skills', () => {
    registry.register(createSkill('a'));
    registry.register(createSkill('b'));

    const prompts = registry.getEnabledPrompts();

    expect(prompts).toContain('Prompt for a');
    expect(prompts).toContain('Prompt for b');
  });

  it('should exclude disabled skills from prompts', () => {
    registry.register(createSkill('a'));
    registry.register(createSkill('b'));
    registry.disable('b');

    const prompts = registry.getEnabledPrompts();

    expect(prompts).toContain('Prompt for a');
    expect(prompts).not.toContain('Prompt for b');
  });

  it('should return empty string when no skills registered', () => {
    expect(registry.getEnabledPrompts()).toBe('');
    expect(registry.getEnabledTools()).toEqual([]);
  });

  it('should register skill from file path string', () => {
    vi.mock('node:fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(JSON.stringify({
        name: 'file-skill',
        description: 'From file',
        prompt: 'File prompt',
      })),
    }));

    const freshRegistry = new SkillRegistry(eventBus as unknown as typeof eventBus);
    freshRegistry.register('/path/to/skill.json');

    expect(freshRegistry.get('file-skill')).toBeDefined();
  });
});
