/** Audit log entry */
export interface AuditEntry {
  timestamp: number;
  tool: string;
  action: string;
  args: unknown;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * Operation audit log — records all tool invocations.
 */
export class AuditLog {
  #entries: AuditEntry[] = [];

  /** Record a tool invocation */
  record(entry: Omit<AuditEntry, 'timestamp'>): void {
    this.#entries.push({ ...entry, timestamp: Date.now() });
  }

  /** Get all log entries */
  getEntries(): ReadonlyArray<AuditEntry> {
    return [...this.#entries];
  }

  /** Export as JSON string */
  toJSON(): string {
    return JSON.stringify(this.#entries, null, 2);
  }

  /** Filter entries by tool name */
  filterByTool(tool: string): AuditEntry[] {
    return this.#entries.filter((e) => e.tool === tool);
  }

  /** Filter entries by success status */
  filterBySuccess(success: boolean): AuditEntry[] {
    return this.#entries.filter((e) => e.success === success);
  }

  /** Clear all entries */
  clear(): void {
    this.#entries = [];
  }

  /** Get entry count */
  get size(): number {
    return this.#entries.length;
  }
}
