import { OpenAIModel } from './openai';

/**
 * DashScope (通义千问) adapter — OpenAI-compatible API.
 * Supports qwen-plus, qwen-turbo, qwen-max, and other DashScope models.
 */
export class DashScopeModel extends OpenAIModel {
  static readonly baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor(config: { apiKey: string; model: string }) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: DashScopeModel.baseUrl,
    });
  }
}
