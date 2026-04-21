import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../../src/core/agent';
import { Sandbox } from '../../../src/security/sandbox';
import type { ModelResponse } from '../../../src/types/model';

const mockGenerate = vi.fn().mockResolvedValue({ text: 'Final Answer: done' } as ModelResponse);
const mockStream = vi.fn().mockImplementation(async function* () {
  yield { text: 'chunk', done: false };
  yield { text: 'done', done: true };
});

vi.mock('../../src/model/registry', () => ({
  modelRegistry: {
    create: () => ({
      generate: mockGenerate,
      stream: mockStream,
    }),
  },
}));

vi.mock('../../src/mcp/client', () => ({
  MCPClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: false,
    state: 'disconnected',
  })),
}));

function createTool(name: string) {
  return {
    name,
    description: `Tool ${name}`,
    execute: vi.fn().mockResolvedValue({ success: true, data: 'ok' }),
  };
}

function createAgent() {
  return new Agent({
    model: 'gpt-4o',
    apiKey: 'test-key',
  });
}

describe('Agent: Tool hotswap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add a tool at runtime', () => {
    const agent = createAgent();
    const tool = createTool('new-tool');

    agent.addTool(tool);

    const tools = agent.config.tools;
    expect(tools?.length).toBeGreaterThan(0);
    const names = (tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('new-tool');
  });

  it('should replace an existing tool with the same name', () => {
    const agent = createAgent();
    const toolV1 = createTool('replaceable');
    agent.addTool(toolV1);

    const toolV2 = createTool('replaceable');
    agent.addTool(toolV2);

    const names = (agent.config.tools as Array<{ name: string }>).map((t) => t.name);
    const count = names.filter((n) => n === 'replaceable').length;
    expect(count).toBe(1);
  });

  it('should remove a tool at runtime', () => {
    const agent = createAgent();
    const tool = createTool('removable');
    agent.addTool(tool);

    agent.removeTool('removable');

    const names = (agent.config.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).not.toContain('removable');
  });

  it('should remove a tool contributed by a skill', () => {
    const skillTool = createTool('skill-tool');
    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      skills: [{
        name: 'tool-skill',
        description: 'Skill with tool',
        prompt: 'Use the tool',
        tools: [skillTool],
      }],
    });

    const namesBefore = (agent.config.tools as Array<{ name: string }>).map((t) => t.name);
    expect(namesBefore).toContain('skill-tool');

    agent.removeTool('skill-tool');

    const namesAfter = (agent.config.tools as Array<{ name: string }>).map((t) => t.name);
    expect(namesAfter).not.toContain('skill-tool');
  });

  it('should emit onToolRegistered when adding a new tool', () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const agent = createAgent();

    agent.on('onToolRegistered', (data: unknown) => events.push({ event: 'onToolRegistered', data }));
    agent.on('onToolUpdated', (data: unknown) => events.push({ event: 'onToolUpdated', data }));

    agent.addTool(createTool('emit-tool'));

    expect(events.some((e) => e.event === 'onToolRegistered')).toBe(true);
    expect(events.some((e) => e.event === 'onToolUpdated')).toBe(false);
  });

  it('should emit onToolUpdated when replacing an existing tool', () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const agent = createAgent();

    agent.on('onToolRegistered', (data: unknown) => events.push({ event: 'onToolRegistered', data }));
    agent.on('onToolUpdated', (data: unknown) => events.push({ event: 'onToolUpdated', data }));

    agent.addTool(createTool('replaceable'));
    events.length = 0;

    agent.addTool(createTool('replaceable'));

    expect(events.some((e) => e.event === 'onToolUpdated')).toBe(true);
    expect(events.some((e) => e.event === 'onToolRegistered')).toBe(false);
  });

  it('should clean #skillToolNames when removing a tool', () => {
    const skillTool = createTool('skill-tool');
    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      skills: [{
        name: 'tool-skill',
        description: 'Skill with tool',
        prompt: 'Use the tool',
        tools: [skillTool],
      }],
    });

    agent.removeTool('skill-tool');

    // After removing, enableSkill should not re-add the tool
    agent.disableSkill('tool-skill');
    agent.enableSkill('tool-skill');

    const names = (agent.config.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).not.toContain('skill-tool');
  });

  it('should clear all tools and disable skills', () => {
    const skillTool = createTool('skill-tool');
    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      skills: [{
        name: 'tool-skill',
        description: 'Skill with tool',
        prompt: 'Use the tool',
        tools: [skillTool],
      }],
    });

    agent.addTool(createTool('standalone'));
    agent.clearTools();

    expect(agent.config.tools).toEqual([]);
    const skills = agent.getSkills();
    expect(skills.every((s) => !s.enabled)).toBe(true);
  });

  it('should restore original sandbox config on updateSandbox(true)', () => {
    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      sandbox: { allowedPaths: ['/home'] },
    });

    agent.updateSandbox(false);
    expect(agent.config.sandbox).toBe(false);

    agent.updateSandbox(true);
    expect(agent.config.sandbox).toBe(true);
  });

  it('should emit onToolRemoved when removing a tool', () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const agent = createAgent();

    agent.on('onToolRemoved', (data: unknown) => events.push({ event: 'onToolRemoved', data }));

    agent.addTool(createTool('remove-me'));
    agent.removeTool('remove-me');

    expect(events.some((e) => e.event === 'onToolRemoved')).toBe(true);
  });

  it('should not emit onToolRemoved when removing a non-existent tool', () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const agent = createAgent();

    agent.on('onToolRemoved', (data: unknown) => events.push({ event: 'onToolRemoved', data }));

    agent.removeTool('nonexistent');

    expect(events.some((e) => e.event === 'onToolRemoved')).toBe(false);
  });

  it('should clear all tools', () => {
    const agent = createAgent();
    agent.addTool(createTool('a'));
    agent.addTool(createTool('b'));

    agent.clearTools();

    expect(agent.config.tools).toEqual([]);
  });
});

describe('Agent: Sandbox hotswap', () => {
  it('should enable sandbox at runtime', () => {
    const agent = createAgent();

    agent.updateSandbox(new Sandbox({ allowedPaths: ['/tmp'] }));

    expect(agent.config.sandbox).toBeDefined();
  });

  it('should disable sandbox at runtime', () => {
    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      sandbox: { allowedPaths: ['/tmp'] },
    });

    agent.updateSandbox(false);

    expect(agent.config.sandbox).toBe(false);
  });

  it('should replace sandbox at runtime', () => {
    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      sandbox: { allowedPaths: ['/tmp'] },
    });

    agent.updateSandbox(new Sandbox({ allowedPaths: ['/home'] }));

    expect(agent.config.sandbox).toBeDefined();
  });
});

describe('Agent: Config hotswap', () => {
  it('should update maxSteps at runtime', () => {
    const agent = createAgent();

    agent.updateConfig({ maxSteps: 100 });

    expect(agent.config.maxSteps).toBe(100);
  });

  it('should update maxRetries at runtime', () => {
    const agent = createAgent();

    agent.updateConfig({ maxRetries: 5 });

    expect(agent.config.maxRetries).toBe(5);
  });

  it('should update verbose at runtime', () => {
    const agent = createAgent();

    agent.updateConfig({ verbose: true });

    expect(agent.config.verbose).toBe(true);
  });

  it('should update multiple config fields at once', () => {
    const agent = createAgent();

    agent.updateConfig({ maxSteps: 200, maxRetries: 10, verbose: true });

    expect(agent.config.maxSteps).toBe(200);
    expect(agent.config.maxRetries).toBe(10);
    expect(agent.config.verbose).toBe(true);
  });
});
