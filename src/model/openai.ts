import OpenAI from 'openai';
import { BaseModel } from './base';
import type { GenerateOptions, ModelResponse, StreamChunk } from '../types/model';

/**
 * OpenAI model adapter (GPT-3.5/4/4o/o1/o3)
 */
export class OpenAIModel extends BaseModel {
  #client: OpenAI;

  constructor(config: { apiKey: string; model: string; baseUrl?: string }) {
    super({ provider: 'openai', model: config.model, apiKey: config.apiKey, baseUrl: config.baseUrl });
    this.#client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<ModelResponse> {
    const response = await this.#client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      ...(options?.maxTokens != null ? { max_tokens: options.maxTokens } : {}),
      temperature: options?.temperature,
      stop: options?.stop,
      stream: false,
    });

    const choice = response.choices[0];
    return {
      text: choice?.message?.content ?? '',
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
      stopReason: choice?.finish_reason === 'length' ? 'max_tokens' : 'stop',
    };
  }

  async *stream(prompt: string, options?: GenerateOptions): AsyncIterable<StreamChunk> {
    const stream = await this.#client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens,
      temperature: options?.temperature,
      stop: options?.stop,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) {
        yield { text, done: false };
      }
    }
    yield { text: '', done: true };
  }
}
