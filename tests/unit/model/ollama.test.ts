import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaModel } from '../../../src/model/ollama';
import type { ModelResponse, StreamChunk } from '../../../src/types/model';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OllamaModel', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('generate', () => {
    it('should return text on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Hello from Ollama', done: true }),
      });

      const model = new OllamaModel({ apiKey: '', model: 'llama3' });
      const result = await model.generate('Say hello');

      expect(result.text).toBe('Hello from Ollama');
      expect(result.usage.promptTokens).toBe(0);
      expect(result.usage.completionTokens).toBe(0);
    });

    it('should use default localhost URL', () => {
      const model = new OllamaModel({ apiKey: '', model: 'llama3' });
      expect(model.baseUrl).toBe('http://localhost:11434');
      expect(model.provider).toBe('ollama');
    });

    it('should use custom base URL', () => {
      const model = new OllamaModel({ apiKey: '', model: 'llama3', baseUrl: 'http://custom:11434' });
      expect(model.baseUrl).toBe('http://custom:11434');
    });

    it('should pass options to the API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'ok', done: true }),
      });

      const model = new OllamaModel({ apiKey: '', model: 'llama3' });
      await model.generate('test', { maxTokens: 100, temperature: 0.5 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"num_predict":100'),
        }),
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const model = new OllamaModel({ apiKey: '', model: 'llama3' });
      await expect(model.generate('test')).rejects.toThrow('Ollama API error: 500');
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const model = new OllamaModel({ apiKey: '', model: 'llama3' });
      const result = await model.generate('test');

      expect(result.text).toBe('');
    });
  });

  describe('stream', () => {
    it('should yield text chunks from NDJSON stream', async () => {
      const chunks = [
        JSON.stringify({ response: 'Hello', done: false }) + '\n',
        JSON.stringify({ response: ' world', done: false }) + '\n',
        JSON.stringify({ response: '', done: true }) + '\n',
      ];

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[2]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const model = new OllamaModel({ apiKey: '', model: 'llama3' });
      const collected: StreamChunk[] = [];
      for await (const chunk of model.stream('test')) {
        collected.push(chunk);
      }

      expect(collected.slice(0, -1).map((c) => c.text)).toEqual(['Hello', ' world']);
      expect(collected[collected.length - 1].done).toBe(true);
    });

    it('should handle empty stream', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const model = new OllamaModel({ apiKey: '', model: 'llama3' });
      const collected: StreamChunk[] = [];
      for await (const chunk of model.stream('test')) {
        collected.push(chunk);
      }

      expect(collected).toEqual([{ text: '', done: true }]);
    });

    it('should throw on API error in stream', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const model = new OllamaModel({ apiKey: '', model: 'llama3' });
      await expect(model.stream('test').next()).rejects.toThrow('Ollama API error: 404');
    });
  });
});
