/** Log level */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Log entry structure */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Structured logger — JSON-formatted logs with levels.
 */
export class Logger {
  #level: LogLevel;
  #entries: LogEntry[] = [];
  #verbose: boolean;

  constructor(options?: { level?: LogLevel; verbose?: boolean }) {
    this.#level = options?.level ?? 'info';
    this.#verbose = options?.verbose ?? false;
  }

  /** Enable verbose/debug mode */
  verbose(): void {
    this.#verbose = true;
    this.#level = 'debug';
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (shouldLog(level, this.#level)) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
      };
      this.#entries.push(entry);
      // Also output to console in verbose mode
      if (this.#verbose) {
        const output = JSON.stringify(entry);
        switch (level) {
          case 'warn': console.warn(output); break;
          case 'error': console.error(output); break;
          default: console.log(output);
        }
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /** Get all log entries */
  getEntries(): ReadonlyArray<LogEntry> {
    return [...this.#entries];
  }

  /** Export logs as JSON */
  toJSON(): string {
    return JSON.stringify(this.#entries, null, 2);
  }
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(messageLevel: LogLevel, minLevel: LogLevel): boolean {
  return LEVEL_ORDER[messageLevel] >= LEVEL_ORDER[minLevel];
}
