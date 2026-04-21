import type { ModelProviderConfig } from '../types/model';
import type { BaseModel } from './base';
import { OpenAIModel } from './openai';
import { AnthropicModel } from './anthropic';

type ModelFactory = (config: { apiKey: string; model: string; baseUrl?: string }) => BaseModel;

/** Model provider registry — maps model identifiers to factory functions */
export class ModelRegistry {
  #providers = new Map<string, ModelProviderConfig>();
  #factories = new Map<string, ModelFactory>();

  /** Register a provider config for model name matching */
  registerProvider(prefix: string, config: ModelProviderConfig): void {
    this.#providers.set(prefix, config);
  }

  /** Register a factory for creating model instances */
  registerFactory(provider: string, factory: ModelFactory): void {
    this.#factories.set(provider, factory);
  }

  /** Resolve a model identifier to a provider config */
  resolve(modelId: string): ModelProviderConfig | undefined {
    for (const [prefix, config] of this.#providers) {
      if (modelId.startsWith(prefix)) {
        return config;
      }
    }
    return undefined;
  }

  /** Create a model instance from a model identifier */
  create(modelId: string, apiKey: string): BaseModel {
    const providerConfig = this.resolve(modelId);
    if (!providerConfig) {
      throw new Error(`Unknown model: ${modelId}. Register it first.`);
    }
    const factory = this.#factories.get(providerConfig.provider);
    if (!factory) {
      throw new Error(`No factory registered for provider: ${providerConfig.provider}`);
    }
    return factory({
      apiKey,
      model: modelId,
      baseUrl: providerConfig.baseUrl,
    });
  }
}

/** Default model registry singleton */
export const modelRegistry = new ModelRegistry();

// Register built-in providers and factories
modelRegistry.registerProvider('gpt', { provider: 'openai' });
modelRegistry.registerProvider('o1', { provider: 'openai' });
modelRegistry.registerProvider('o3', { provider: 'openai' });
modelRegistry.registerProvider('claude', { provider: 'anthropic' });

modelRegistry.registerFactory('openai', (cfg) => new OpenAIModel(cfg));
modelRegistry.registerFactory('anthropic', (cfg) => new AnthropicModel(cfg));
