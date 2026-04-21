import { AGENT_EVENTS, type EventBus, type EventHandler } from '../types/event';
import { matchesPattern } from '../utils/glob';

// Re-export for consumers who don't want to import from types/
export { AGENT_EVENTS };

/**
 * Lightweight event bus supporting exact match and glob patterns
 * (`*` matches any chars within a segment, `**` matches across segments).
 */
export class DefaultEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, data?: unknown): void {
    for (const [pattern, handlers] of this.handlers) {
      if (matchesPattern(event, pattern)) {
        for (const handler of handlers) {
          handler(data);
        }
      }
    }
  }

  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (data) => {
      this.off(event, wrapper);
      handler(data);
    };
    this.on(event, wrapper);
  }
}
