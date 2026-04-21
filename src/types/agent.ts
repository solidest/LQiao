import type { Tool } from './tool';
import type { MCPServerConfig } from './mcp';
import type { SkillConfig } from './skill';

/** Supported model providers */
export type ModelProvider = 'openai' | 'anthropic' | 'dashscope' | 'deepseek' | 'ollama';

/** Agent configuration */
export interface AgentConfig {
  /** Model identifier (e.g. 'gpt-4o', 'claude-3.7') or provider enum */
  model: string | ModelProvider;
  /** API key for the model provider */
  apiKey?: string;
  /** Tools available to the agent */
  tools?: Tool[];
  /** MCP server configurations */
  mcpServers?: MCPServerConfig[];
  /** Skills to load into the agent */
  skills?: SkillConfig[];
  /** Sandbox configuration */
  sandbox?: boolean | SandboxConfig;
  /** Maximum reasoning steps (default: 50) */
  maxSteps?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Enable verbose debug logging */
  verbose?: boolean;
}

/** Sandbox configuration */
export interface SandboxConfig {
  /** Allowed file paths (whitelist) */
  allowedPaths?: string[];
  /** Blocked file paths (blacklist) */
  blockedPaths?: string[];
  /** Blocked shell commands */
  blockedCommands?: string[];
  /** Execution timeout in milliseconds */
  timeout?: number;
  /** Memory limit in MB */
  memoryLimit?: number;
}
