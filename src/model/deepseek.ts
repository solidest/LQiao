import { OpenAIModel } from './openai';

/**
 * DeepSeek adapter — OpenAI-compatible API.
 * Supports deepseek-chat, deepseek-coder, and other DeepSeek models.
 */
export class DeepSeekModel extends OpenAIModel {
  static readonly baseUrl = 'https://api.deepseek.com/v1';

  constructor(config: { apiKey: string; model: string }) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: DeepSeekModel.baseUrl,
    });
  }
}
