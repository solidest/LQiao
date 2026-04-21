import { describe, it, expect, beforeEach } from 'vitest';
import { Logger } from '../../../src/logger/logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  it('should log at info level by default', () => {
    logger.info('test message');
    expect(logger.getEntries()).toHaveLength(1);
    expect(logger.getEntries()[0].level).toBe('info');
  });

  it('should not log below minimum level', () => {
    const l = new Logger({ level: 'warn' });
    l.debug('should not appear');
    l.info('should not appear');
    l.warn('should appear');
    expect(l.getEntries()).toHaveLength(1);
  });

  it('should log all levels in verbose mode', () => {
    logger.verbose();
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');
    expect(logger.getEntries()).toHaveLength(4);
  });

  it('should include context', () => {
    logger.info('with context', { key: 'value' });
    expect(logger.getEntries()[0].context).toEqual({ key: 'value' });
  });

  it('should include ISO timestamps', () => {
    logger.info('timed');
    const entry = logger.getEntries()[0];
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should export to JSON', () => {
    logger.info('test');
    const json = logger.toJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
