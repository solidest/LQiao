import Anthropic from '@anthropic-ai/sdk';
import { BaseModel } from './base';
import type { GenerateOptions, ModelResponse, StreamChunk } from '../types/model';

type AnthropicModelId = Anthropic.MessageCreateParamsNonStreaming['model'];
type AnthropicStreamModelId = Anthropic.MessageCreateParamsStreaming['model'];

/**
 * Anthropic Claude model adapter (Claude 3.x)
 */
export class AnthropicModel extends BaseModel {
  #client: Anthropic;

  constructor(config: { apiKey: string; model: string; baseUrl?: string }) {
    super({ provider: 'anthropic', model: config.model, apiKey: config.apiKey, baseUrl: config.baseUrl });
    this.#client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<ModelResponse> {
    const response = await this.#client.messages.create({
      model: this.model as AnthropicModelId,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      system: options?.system,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';

    return {
      text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
      stopReason: response.stop_reason === 'max_tokens' ? 'max_tokens' : 'stop',
    };
  }

  async *stream(prompt: string, options?: GenerateOptions): AsyncIterable<StreamChunk> {
    const stream = await this.#client.messages.create({
      model: this.model as AnthropicStreamModelId,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      system: options?.system,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { text: event.delta.text, done: false };
      }
    }
    yield { text: '', done: true };
  }
}
