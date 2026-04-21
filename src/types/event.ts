/** Known agent lifecycle event names */
export type AgentEvent =
  | 'beforeRun'
  | 'afterRun'
  | 'onStep'
  | 'onToolCall'
  | 'onToolResult'
  | 'onError'
  | 'onSkillLoaded'
  | 'onSkillEnabled'
  | 'onSkillDisabled';

/** Event name constants (runtime-safe) */
export const AGENT_EVENTS = {
  BEFORE_RUN: 'beforeRun',
  AFTER_RUN: 'afterRun',
  ON_STEP: 'onStep',
  ON_TOOL_CALL: 'onToolCall',
  ON_TOOL_RESULT: 'onToolResult',
  ON_ERROR: 'onError',
} as const;

/** Event handler function */
export type EventHandler = (data: unknown) => void | Promise<void>;

/** Minimal event bus interface */
export interface EventBus {
  /** Register an event handler */
  on(event: string, handler: EventHandler): void;
  /** Remove a previously registered handler */
  off(event: string, handler: EventHandler): void;
  /** Emit an event, invoking all registered handlers */
  emit(event: string, data?: unknown): void;
  /** Register a one-time event handler */
  once(event: string, handler: EventHandler): void;
}
