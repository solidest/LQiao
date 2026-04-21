import type { ModelProvider } from './agent';

/** Model generation options */
export interface GenerateOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Stop sequences */
  stop?: string[];
  /** Enable streaming */
  stream?: boolean;
  /** System prompt */
  system?: string;
}

/** Model generation response */
export interface ModelResponse {
  /** Generated text content */
  text: string;
  /** Token usage information */
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  /** Reason generation stopped */
  stopReason: 'stop' | 'max_tokens' | 'error';
}

/** Streaming response chunk */
export interface StreamChunk {
  /** Text delta in this chunk */
  text: string;
  /** Whether this is the final chunk */
  done: boolean;
}

/** Model provider configuration */
export interface ModelProviderConfig {
  /** Provider name */
  provider: ModelProvider;
  /** API base URL (override default) */
  baseUrl?: string;
  /** Default model identifier */
  defaultModel?: string;
}
