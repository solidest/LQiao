import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistry } from '../../../src/model/registry';
import { BaseModel } from '../../../src/model/base';

class MockModel extends BaseModel {
  constructor(config: { apiKey: string; model: string }) {
    super({ provider: 'mock', model: config.model, apiKey: config.apiKey });
  }

  async generate() {
    return { text: 'mock', usage: { promptTokens: 1, completionTokens: 1 }, stopReason: 'stop' as const };
  }

  async *stream() {
    yield { text: 'mock', done: true };
  }
}

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
    registry.registerProvider('gpt', { provider: 'openai' });
    registry.registerProvider('claude', { provider: 'anthropic' });
    registry.registerFactory('openai', (cfg) => new MockModel({ apiKey: cfg.apiKey, model: cfg.model }));
    registry.registerFactory('anthropic', (cfg) => new MockModel({ apiKey: cfg.apiKey, model: cfg.model }));
  });

  it('should resolve model identifiers to providers', () => {
    const openai = registry.resolve('gpt-4o');
    expect(openai?.provider).toBe('openai');

    const anthropic = registry.resolve('claude-3.7');
    expect(anthropic?.provider).toBe('anthropic');
  });

  it('should return undefined for unknown models', () => {
    expect(registry.resolve('unknown-model')).toBeUndefined();
  });

  it('should create model instances via registry', () => {
    const model = registry.create('gpt-4o', 'test-key');
    expect(model).toBeInstanceOf(BaseModel);
    expect(model.model).toBe('gpt-4o');
    expect(model.provider).toBe('mock');
  });

  it('should throw for unknown model identifiers', () => {
    expect(() => registry.create('unknown-model', 'key')).toThrow('Unknown model');
  });

  it('should throw when factory is not registered', () => {
    registry.registerProvider('custom', { provider: 'custom-provider' });
    expect(() => registry.create('custom-v1', 'key')).toThrow('No factory registered');
  });
});
