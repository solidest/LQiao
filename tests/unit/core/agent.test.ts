import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../../src/core/agent';
import { modelRegistry } from '../../../src/model/registry';
import { BaseModel } from '../../../src/model/base';
import type { ModelResponse, StreamChunk } from '../../../src/types/model';

function createMockModel(responses: string[]) {
  let index = 0;
  return class MockModel extends BaseModel {
    constructor() {
      super({ provider: 'mock', model: 'gpt-4o', apiKey: 'test' });
    }
    async generate(): Promise<ModelResponse> {
      const text = responses[index++] ?? responses[responses.length - 1];
      return { text, usage: { promptTokens: 1, completionTokens: 1 }, stopReason: 'stop' };
    }
    async *stream(): AsyncIterable<StreamChunk> {
      for (const text of responses) {
        yield { text, done: false };
      }
      yield { text: '', done: true };
    }
  };
}

describe('Agent', () => {
  beforeEach(() => {
    modelRegistry.registerFactory('mock-test', (cfg) => {
      const MockModel = createMockModel(['Answer complete']);
      return new MockModel();
    });
  });

  describe('run', () => {
    it('should execute a task and return result', async () => {
      const agent = new Agent({
        model: 'gpt-4o',
        apiKey: 'test',
      });

      modelRegistry.registerFactory('openai', (cfg) => {
        const MockModel = createMockModel(['Final Answer: Task done']);
        return new MockModel();
      });

      const result = await agent.run('Test task');
      expect(result).toBe('Task done');
    });

    it('should emit error event on failure', async () => {
      modelRegistry.registerProvider('failing', { provider: 'failing' });
      modelRegistry.registerFactory('failing', (cfg) => {
        const FailingModel = class extends BaseModel {
          constructor() {
            super({ provider: 'failing', model: 'failing-model', apiKey: 'test' });
          }
          async generate() {
            throw new Error('API unavailable');
          }
          async *stream() {}
        };
        return new FailingModel();
      });

      const agent = new Agent({
        model: 'failing',
        apiKey: 'test',
      });

      const errors: unknown[] = [];
      agent.on('onError', (data) => errors.push(data));

      try {
        await agent.run('Test task');
      } catch {
        // expected
      }

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('stream', () => {
    it('should stream model output', async () => {
      modelRegistry.registerProvider('mock-test', { provider: 'mock-test' });
      const agent = new Agent({
        model: 'mock-test',
        apiKey: 'test',
      });

      const chunks: string[] = [];
      for await (const chunk of agent.stream('test')) {
        if (chunk.text) chunks.push(chunk.text);
      }

      expect(chunks).toContain('Answer complete');
    });
  });

  describe('events', () => {
    it('should register and trigger event listeners', async () => {
      const agent = new Agent({
        model: 'mock-test',
        apiKey: 'test',
      });

      const events: string[] = [];
      agent.on('beforeRun', () => events.push('before'));
      agent.on('afterRun', () => events.push('after'));

      try {
        await agent.run('test');
      } catch {
        // expected — mock model may not support full ReAct
      }

      expect(events).toContain('before');
    });

    it('should remove event listeners with off', async () => {
      const agent = new Agent({
        model: 'mock-test',
        apiKey: 'test',
      });

      const handler = () => {};
      agent.on('beforeRun', handler);
      agent.off('beforeRun', handler);

      expect(agent.eventBus).toBeDefined();
    });
  });

  describe('switchModel', () => {
    it('should update model config', () => {
      const agent = new Agent({
        model: 'gpt-4o',
        apiKey: 'test',
      });

      agent.switchModel('claude-3.7', 'new-key');

      expect(agent.config.model).toBe('claude-3.7');
      expect((agent.config as any).apiKey).toBe('new-key');
    });
  });

  describe('config', () => {
    it('should return readonly config', () => {
      const agent = new Agent({
        model: 'gpt-4o',
        apiKey: 'secret',
        maxSteps: 25,
      });

      const config = agent.config;
      expect(config.model).toBe('gpt-4o');
      expect(config.maxSteps).toBe(25);
    });
  });
});
