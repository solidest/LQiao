import { describe, it, expect, vi } from 'vitest';
import { DefaultEventBus, AGENT_EVENTS } from '../../../src/core/event-bus';

describe('DefaultEventBus', () => {
  it('should register and emit events', () => {
    const bus = new DefaultEventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.emit('test', { value: 42 });
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('should support removing handlers with off', () => {
    const bus = new DefaultEventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.off('test', handler);
    bus.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support once (auto-unsubscribe after first call)', () => {
    const bus = new DefaultEventBus();
    const handler = vi.fn();
    bus.once('test', handler);
    bus.emit('test', 'first');
    bus.emit('test', 'second');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('should match wildcard patterns with *', () => {
    const bus = new DefaultEventBus();
    const handler = vi.fn();
    bus.on('on*', handler);
    bus.emit('onStep');
    bus.emit('onToolCall');
    bus.emit('otherEvent');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should match ** pattern for all events', () => {
    const bus = new DefaultEventBus();
    const handler = vi.fn();
    bus.on('**', handler);
    bus.emit('any.event.name');
    bus.emit('other');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should support multiple handlers for the same event', () => {
    const bus = new DefaultEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('test', h1);
    bus.on('test', h2);
    bus.emit('test');
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('should handle async handlers', async () => {
    const bus = new DefaultEventBus();
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.on('test', handler);
    bus.emit('test');
    expect(handler).toHaveBeenCalled();
  });

  it('should not match unrelated events', () => {
    const bus = new DefaultEventBus();
    const handler = vi.fn();
    bus.on('specific.event', handler);
    bus.emit('unrelated');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should export AGENT_EVENTS constants', () => {
    expect(AGENT_EVENTS.BEFORE_RUN).toBe('beforeRun');
    expect(AGENT_EVENTS.ON_ERROR).toBe('onError');
  });
});
