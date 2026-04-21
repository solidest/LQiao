import type { Tool } from './tool';

/** Skill configuration — defines a domain-specific capability */
export interface SkillConfig {
  /** Unique skill name */
  name: string;
  /** Human-readable description for model discovery */
  description: string;
  /** System prompt fragment injected into ReAct agent */
  prompt: string;
  /** Tools contributed by this skill */
  tools?: Tool[];
  /** Whether the skill is active (default: true) */
  enabled?: boolean;
}

/** Resolved skill instance */
export interface Skill {
  name: string;
  description: string;
  prompt: string;
  tools: Tool[];
  enabled: boolean;
}
