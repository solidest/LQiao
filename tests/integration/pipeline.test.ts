import { describe, it, expect } from 'vitest';
import { Agent, FileTool, ReactAgent, CodeAgent, Sandbox, DefaultEventBus, AGENT_EVENTS } from '../../src';
import type { ModelResponse } from '../../src/types/model';

/** Mock model that returns predefined responses in sequence */
function mockModel(responses: string[]) {
  let index = 0;
  return {
    async generate(): Promise<ModelResponse> {
      const text = responses[index] ?? responses[responses.length - 1];
      index++;
      return { text, usage: { promptTokens: 10, completionTokens: 10 }, stopReason: 'stop' };
    },
    async *stream() {
      yield { text: 'streamed', done: true };
    },
  };
}

describe('Integration: Agent + ReAct + Tools', () => {
  it('should run a full pipeline: agent → ReAct → tool → result', async () => {
    const sandbox = new Sandbox({ allowedPaths: [process.cwd()] });
    const fileTool = new FileTool(sandbox);
    const events: string[] = [];
    const eventBus = new DefaultEventBus();
    eventBus.on('**', () => events.push('event'));

    const agent = new ReactAgent({
      tools: [fileTool],
      eventBus,
      maxSteps: 5,
    });

    const model = mockModel([
      'Thought: Reading file\nAction: file\nAction Input: {"0": "read", "1": "package.json"}',
      'Thought: I have the answer\nFinal Answer: Found the package',
    ]);

    const result = await agent.run(
      (prompt) => model.generate(prompt),
      'Read package.json',
    );

    expect(result).toBe('Found the package');
    expect(events.length).toBeGreaterThan(0);
  });

  it('should handle tool errors and continue', async () => {
    const agent = new ReactAgent({ tools: [new FileTool()], maxSteps: 3 });
    const model = mockModel([
      'Thought: Reading\nAction: file\nAction Input: {"0": "read", "1": "nonexistent.txt"}',
      'Thought: File not found\nFinal Answer: File does not exist',
    ]);

    const result = await agent.run(
      (prompt) => model.generate(prompt),
      'Read a file',
    );
    expect(result).toBe('File does not exist');
  });
});

describe('Integration: CodeAgent + Sandbox', () => {
  it('should parse and execute code through sandbox', async () => {
    const sandbox = new Sandbox({ timeout: 5000 });
    const codeAgent = new CodeAgent(sandbox);

    const results = await codeAgent.executeFromResponse(
      '```javascript\nreturn [1, 2, 3].map(x => x * 2);\n```',
    );

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].output).toEqual([2, 4, 6]);
  });

  it('should block dangerous code execution', async () => {
    const sandbox = new Sandbox({ timeout: 1000 });
    const codeAgent = new CodeAgent(sandbox);

    const result = await codeAgent.executeCode('return require("fs");');
    expect(result.success).toBe(false);
  });
});

describe('Integration: Event Bus + Agent lifecycle', () => {
  it('should emit complete event chain for a ReAct run', async () => {
    const eventBus = new DefaultEventBus();
    const eventLog: { event: string; data: unknown }[] = [];
    eventBus.on('**', (data) => eventLog.push({ event: 'any', data }));

    const agent = new ReactAgent({
      tools: [],
      eventBus,
      maxSteps: 3,
    });

    const model = mockModel([
      'Thought: Starting\nAction: nonexistent\nAction Input: {}',
      'Thought: Done\nFinal Answer: Complete',
    ]);

    await agent.run((p) => model.generate(p), 'Test task');

    expect(eventLog.length).toBeGreaterThan(2);
    const hasStep = eventLog.some((e) => e.event === 'any' && (e.data as any).step !== undefined);
    expect(hasStep).toBe(true);
  });
});

describe('Integration: Security pipeline (Sandbox + Permissions)', () => {
  it('should block file access outside sandbox and log it', async () => {
    const sandbox = new Sandbox({ allowedPaths: ['/tmp/test'] });
    expect(() => sandbox.validatePath('/etc/passwd')).toThrow();
  });

  it('should throw SANDBOX_VIOLATION for path escape', async () => {
    const sandbox = new Sandbox({ allowedPaths: ['/tmp/test'] });
    try {
      sandbox.validatePath('/etc/passwd');
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.type).toBe('SANDBOX_VIOLATION');
    }
  });
});
