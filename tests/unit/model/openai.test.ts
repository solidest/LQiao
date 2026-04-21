import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIModel } from '../../../src/model/openai';
import type { ModelResponse } from '../../../src/types/model';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

describe('OpenAIModel', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe('generate', () => {
    it('should return text on success', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello world' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      });

      const model = new OpenAIModel({ apiKey: 'test', model: 'gpt-4o' });
      const result = await model.generate('Say hello');

      expect(result.text).toBe('Hello world');
      expect(result.usage?.promptTokens).toBe(5);
      expect(result.stopReason).toBe('stop');
    });

    it('should handle empty content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 0 },
      });

      const model = new OpenAIModel({ apiKey: 'test', model: 'gpt-4o' });
      const result = await model.generate('Empty');

      expect(result.text).toBe('');
    });

    it('should pass options to the API', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });

      const model = new OpenAIModel({ apiKey: 'test', model: 'gpt-4o' });
      await model.generate('test', { maxTokens: 100, temperature: 0.5 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          max_tokens: 100,
          temperature: 0.5,
        }),
      );
    });

    it('should not send max_tokens when undefined', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });

      const model = new OpenAIModel({ apiKey: 'test', model: 'gpt-4o' });
      await model.generate('test', { temperature: 0.7 });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('max_tokens');
    });

    it('should detect length finish reason', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'long' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });

      const model = new OpenAIModel({ apiKey: 'test', model: 'gpt-4o' });
      const result = await model.generate('test');

      expect(result.stopReason).toBe('max_tokens');
    });
  });

  describe('stream', () => {
    it('should yield text chunks', async () => {
      const chunks = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' world' } }] },
        { choices: [{ delta: { content: null } }] },
      ];
      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: function* () {
          yield* chunks;
        },
      });

      const model = new OpenAIModel({ apiKey: 'test', model: 'gpt-4o' });
      const collected: string[] = [];
      for await (const chunk of model.stream('test')) {
        collected.push(chunk.text);
      }

      expect(collected.slice(0, -1)).toEqual(['Hello', ' world']);
      expect(collected[collected.length - 1]).toBe('');
    });

    it('should handle empty stream', async () => {
      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: function* () {
          // no chunks
        },
      });

      const model = new OpenAIModel({ apiKey: 'test', model: 'gpt-4o' });
      const collected: string[] = [];
      for await (const chunk of model.stream('test')) {
        collected.push(chunk.text);
      }

      expect(collected).toEqual(['']);
    });
  });
});
