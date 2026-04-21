import { describe, it, expect, vi } from 'vitest';
import { ReactAgent } from '../../../src/core/react-agent';
import { ToolBase } from '../../../src/tools/base';
import type { ToolResult } from '../../../src/types/tool';
import type { ModelResponse } from '../../../src/types/model';
import { DefaultEventBus } from '../../../src/core/event-bus';
import { LQiaoError, ERROR_TYPES } from '../../../src/types/error';

class MockTool extends ToolBase {
  name = 'calculator';
  description = 'Evaluate a math expression';

  protected async doExecute(...args: unknown[]): Promise<ToolResult> {
    const input = args[0] as Record<string, unknown>;
    const expr = (input?.expression ?? input?.expr ?? input?.raw ?? '0') as string;
    try {
      const result = Function(`"use strict"; return (${expr})`)();
      return { success: true, data: { result } };
    } catch {
      return { success: false, error: `Invalid expression: ${expr}` };
    }
  }
}

function mockModel(responses: string[]) {
  let index = 0;
  return async (): Promise<ModelResponse> => {
    const text = responses[index] ?? responses[responses.length - 1];
    index++;
    return {
      text,
      usage: { promptTokens: 10, completionTokens: 10 },
      stopReason: 'stop',
    };
  };
}

describe('ReactAgent', () => {
  it('should return final answer directly', async () => {
    const agent = new ReactAgent({ tools: [] });
    const generate = mockModel([
      'Thought: I know the answer\nFinal Answer: 42',
    ]);
    const result = await agent.run(generate, 'What is the answer?');
    expect(result).toBe('42');
  });

  it('should execute tool calls and continue', async () => {
    const agent = new ReactAgent({ tools: [new MockTool()] });
    const generate = mockModel([
      'Thought: Let me calculate\nAction: calculator\nAction Input: {"expression": "2 + 3"}',
      'Thought: Now I know\nFinal Answer: The result is 5',
    ]);
    const result = await agent.run(generate, 'Calculate 2 + 3');
    expect(result).toBe('The result is 5');
  });

  it('should handle unknown tools gracefully', async () => {
    const agent = new ReactAgent({ tools: [] });
    const generate = mockModel([
      'Thought: Let me use a tool\nAction: unknown-tool\nAction Input: {}',
      'Thought: I know the answer\nFinal Answer: Done',
    ]);
    const result = await agent.run(generate, 'Do something');
    expect(result).toBe('Done');
  });

  it('should throw MAX_STEPS error when limit is reached', async () => {
    const agent = new ReactAgent({ tools: [], maxSteps: 2 });
    const generate = mockModel([
      'Thought: Step one\nAction: nothing',
      'Thought: Step two\nAction: nothing',
    ]);
    try {
      await agent.run(generate, 'Test');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LQiaoError);
      expect((e as LQiaoError).type).toBe(ERROR_TYPES.MAX_STEPS);
    }
  });

  it('should emit events during execution', async () => {
    const eventBus = new DefaultEventBus();
    const events: string[] = [];
    eventBus.on('**', () => events.push('event'));

    const agent = new ReactAgent({ tools: [], eventBus });
    const generate = mockModel(['Thought: Done\nFinal Answer: OK']);
    await agent.run(generate, 'Test');
    expect(events.length).toBeGreaterThan(0);
  });

  it('should retry on MODEL_ERROR', async () => {
    const agent = new ReactAgent({ tools: [], maxRetries: 1 });
    let callCount = 0;
    const generate = async (): Promise<ModelResponse> => {
      callCount++;
      if (callCount < 2) {
        throw new LQiaoError(ERROR_TYPES.MODEL_ERROR, 'Temporary failure');
      }
      return {
        text: 'Thought: Success\nFinal Answer: Recovered',
        usage: { promptTokens: 5, completionTokens: 5 },
        stopReason: 'stop',
      };
    };
    const result = await agent.run(generate, 'Test');
    expect(result).toBe('Recovered');
    expect(callCount).toBe(2);
  });
});
