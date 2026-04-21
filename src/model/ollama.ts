import { BaseModel } from './base';
import type { GenerateOptions, ModelResponse, StreamChunk } from '../types/model';

/**
 * Ollama adapter — native REST API (non-OpenAI compatible).
 * Calls local Ollama instance at http://localhost:11434 by default.
 */
export class OllamaModel extends BaseModel {
  constructor(config: { apiKey: string; model: string; baseUrl?: string }) {
    super({
      provider: 'ollama',
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'http://localhost:11434',
    });
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<ModelResponse> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          num_predict: options?.maxTokens,
          temperature: options?.temperature,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as { response?: string; done?: boolean };
    return {
      text: data.response ?? '',
      usage: { promptTokens: 0, completionTokens: 0 },
      stopReason: 'stop',
    };
  }

  async *stream(prompt: string, options?: GenerateOptions): AsyncIterable<StreamChunk> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: true,
        options: {
          num_predict: options?.maxTokens,
          temperature: options?.temperature,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const idx = buffer.indexOf('\n');
        if (idx === -1) break;
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as { response?: string; done?: boolean };
          if (data.response) {
            yield { text: data.response, done: false };
          }
          if (data.done) {
            yield { text: '', done: true };
            return;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
    yield { text: '', done: true };
  }
}
