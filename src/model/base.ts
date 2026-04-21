import type { ModelProviderConfig, GenerateOptions, ModelResponse, StreamChunk } from '../types/model';

/**
 * Abstract model provider base class.
 * All model adapters must extend this class.
 */
export abstract class BaseModel {
  readonly provider: string;
  readonly model: string;
  protected apiKey: string;
  protected baseUrl?: string;

  constructor(config: { provider: string; model: string; apiKey: string; baseUrl?: string }) {
    this.provider = config.provider;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  /** Generate a response from the model */
  abstract generate(prompt: string, options?: GenerateOptions): Promise<ModelResponse>;

  /** Stream a response from the model as an async iterable */
  abstract stream(prompt: string, options?: GenerateOptions): AsyncIterable<StreamChunk>;

  /** Create a model instance from provider config */
  static fromConfig(config: ModelProviderConfig & { apiKey: string; model: string }): BaseModel {
    throw new Error('Use a concrete model provider subclass');
  }
}
