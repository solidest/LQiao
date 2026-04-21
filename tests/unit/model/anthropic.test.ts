import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicModel } from '../../../src/model/anthropic';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: mockCreate,
    };
  },
}));

describe('AnthropicModel', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe('generate', () => {
    it('should return text on success', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello from Claude' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const model = new AnthropicModel({ apiKey: 'test', model: 'claude-3.7' });
      const result = await model.generate('Say hello');

      expect(result.text).toBe('Hello from Claude');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.stopReason).toBe('stop');
    });

    it('should handle non-text content', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'tool_use', name: 'tool' }],
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: 'end_turn',
      });

      const model = new AnthropicModel({ apiKey: 'test', model: 'claude-3.7' });
      const result = await model.generate('test');

      expect(result.text).toBe('');
    });

    it('should pass max_tokens override', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      });

      const model = new AnthropicModel({ apiKey: 'test', model: 'claude-3.7' });
      await model.generate('test', { maxTokens: 2048 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
        }),
      );
    });

    it('should use default max_tokens when not provided', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      });

      const model = new AnthropicModel({ apiKey: 'test', model: 'claude-3.7' });
      await model.generate('test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4096,
        }),
      );
    });

    it('should detect max_tokens stop reason', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'long' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'max_tokens',
      });

      const model = new AnthropicModel({ apiKey: 'test', model: 'claude-3.7' });
      const result = await model.generate('test');

      expect(result.stopReason).toBe('max_tokens');
    });
  });

  describe('stream', () => {
    it('should yield text deltas', async () => {
      const events = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
      ];
      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: function* () {
          yield* events;
        },
      });

      const model = new AnthropicModel({ apiKey: 'test', model: 'claude-3.7' });
      const collected: string[] = [];
      for await (const chunk of model.stream('test')) {
        collected.push(chunk.text);
      }

      expect(collected).toEqual(['Hello', ' world', '']);
    });

    it('should ignore non-text delta events', async () => {
      const events = [
        { type: 'content_block_start', delta: { type: 'text', text: '' } },
        { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } },
      ];
      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: function* () {
          yield* events;
        },
      });

      const model = new AnthropicModel({ apiKey: 'test', model: 'claude-3.7' });
      const collected: string[] = [];
      for await (const chunk of model.stream('test')) {
        if (chunk.text) collected.push(chunk.text);
      }

      expect(collected).toEqual([]);
    });
  });
});
