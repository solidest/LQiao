import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepSeekModel } from '../../../src/model/deepseek';

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

describe('DeepSeekModel', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('should use DeepSeek base URL', () => {
    const model = new DeepSeekModel({ apiKey: 'test', model: 'deepseek-chat' });
    expect(model.baseUrl).toBe(DeepSeekModel.baseUrl);
    expect(model.provider).toBe('openai');
  });

  it('should generate with DeepSeek endpoint', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'DeepSeek response' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 8, completion_tokens: 4 },
    });

    const model = new DeepSeekModel({ apiKey: 'test', model: 'deepseek-chat' });
    const result = await model.generate('Hello');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-chat',
      }),
    );
    expect(result.text).toBe('DeepSeek response');
  });

  it('should stream with DeepSeek endpoint', async () => {
    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: function* () {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' from DeepSeek' } }] };
      },
    });

    const model = new DeepSeekModel({ apiKey: 'test', model: 'deepseek-coder' });
    const collected: string[] = [];
    for await (const chunk of model.stream('test')) {
      collected.push(chunk.text);
    }

    expect(collected.slice(0, -1)).toEqual(['Hello', ' from DeepSeek']);
  });
});
