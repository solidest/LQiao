import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../src/core/agent';
import type { ModelResponse } from '../../src/types/model';

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

describe('Skill Integration with Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createAgentWithSkills(skills: Array<{ name: string; description: string; prompt: string }>) {
    return new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      skills,
    });
  }

  it('should load skills from config', async () => {
    const agent = createAgentWithSkills([
      { name: 'test-skill', description: 'A test skill', prompt: 'You are a testing expert.' },
    ]);

    expect(agent.getSkills()).toHaveLength(1);
    expect(agent.getSkills()[0].name).toBe('test-skill');
  });

  it('should merge skill tools into agent toolset', async () => {
    const mockTool = {
      name: 'skill-tool',
      description: 'Tool from skill',
      execute: vi.fn().mockResolvedValue({ success: true, data: 'ok' }),
    };

    const agent = createAgentWithSkills([]);

    agent.addSkill({
      name: 'tool-skill',
      description: 'Has tools',
      prompt: 'Use your tools',
      tools: [mockTool],
    });

    const config = agent.config;
    const toolNames = (config.tools ?? []).map((t: { name: string }) => t.name);

    expect(toolNames).toContain('skill-tool');
  });

  it('should enable skill at runtime and add its tools', async () => {
    const mockTool = {
      name: 'dynamic-tool',
      description: 'Dynamic tool',
      execute: vi.fn().mockResolvedValue({ success: true, data: 'ok' }),
    };

    const agent = createAgentWithSkills([
      { name: 'disabled', description: 'Disabled skill', prompt: 'Disabled prompt', enabled: false, tools: [mockTool] },
    ]);

    const toolsBefore = (agent.config.tools ?? []).map((t: { name: string }) => t.name);
    expect(toolsBefore).not.toContain('dynamic-tool');

    agent.enableSkill('disabled');

    const toolsAfter = (agent.config.tools ?? []).map((t: { name: string }) => t.name);
    expect(toolsAfter).toContain('dynamic-tool');
  });

  it('should disable skill at runtime', async () => {
    const agent = createAgentWithSkills([
      { name: 'to-disable', description: 'To disable', prompt: 'Should be removed' },
    ]);

    agent.disableSkill('to-disable');

    const skill = agent.getSkills().find((s) => s.name === 'to-disable');
    expect(skill?.enabled).toBe(false);
  });

  it('should remove skill at runtime', async () => {
    const agent = createAgentWithSkills([
      { name: 'to-remove', description: 'To remove', prompt: 'Should be gone' },
    ]);

    agent.removeSkill('to-remove');

    expect(agent.getSkills()).toHaveLength(0);
  });

  it('should emit skill events to event bus', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
    });

    agent.on('onSkillLoaded', (data: unknown) => events.push({ event: 'onSkillLoaded', data }));
    agent.on('onSkillEnabled', (data: unknown) => events.push({ event: 'onSkillEnabled', data }));

    agent.addSkill({ name: 'event-skill', description: 'Event test', prompt: 'Event prompt' });

    expect(events.some((e) => e.event === 'onSkillLoaded')).toBe(true);
  });

  it('should pass skill prompts to ReactAgent via systemPromptSuffix', async () => {
    const agent = createAgentWithSkills([
      { name: 'prompt-skill', description: 'Prompt test', prompt: 'You are an expert.' },
    ]);

    await agent.run('test task');

    expect(mockGenerate).toHaveBeenCalled();
    const callArgs = mockGenerate.mock.calls[0];
    const prompt = callArgs[0];

    expect(prompt).toContain('You are an expert.');
  });
});
