import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashScopeModel } from '../../../src/model/dashscope';

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

describe('DashScopeModel', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('should use DashScope base URL', () => {
    const model = new DashScopeModel({ apiKey: 'test', model: 'qwen-plus' });
    expect(model.baseUrl).toBe(DashScopeModel.baseUrl);
    expect(model.provider).toBe('openai');
  });

  it('should generate with DashScope endpoint', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '你好' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const model = new DashScopeModel({ apiKey: 'test', model: 'qwen-plus' });
    const result = await model.generate('你好');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen-plus',
      }),
    );
    expect(result.text).toBe('你好');
  });

  it('should stream with DashScope endpoint', async () => {
    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: function* () {
        yield { choices: [{ delta: { content: '你好' } }] };
        yield { choices: [{ delta: { content: '世界' } }] };
      },
    });

    const model = new DashScopeModel({ apiKey: 'test', model: 'qwen-plus' });
    const collected: string[] = [];
    for await (const chunk of model.stream('test')) {
      collected.push(chunk.text);
    }

    expect(collected.slice(0, -1)).toEqual(['你好', '世界']);
  });
});
