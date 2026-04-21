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

/** Audit summary statistics */
export interface AuditSummary {
  totalCalls: number;
  successRate: number;
  avgDuration: number;
  topErrors: Array<{ tool: string; error: string; count: number }>;
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

  /** Filter entries by time range (inclusive) */
  filterByTimeRange(from: number, to: number): AuditEntry[] {
    return this.#entries.filter((e) => e.timestamp >= from && e.timestamp <= to);
  }

  /** Compute summary statistics */
  getSummary(): AuditSummary {
    const total = this.#entries.length;
    if (total === 0) {
      return { totalCalls: 0, successRate: 0, avgDuration: 0, topErrors: [] };
    }

    const successCount = this.#entries.filter((e) => e.success).length;
    const avgDuration = this.#entries.reduce((sum, e) => sum + e.duration, 0) / total;

    const errorMap = new Map<string, { tool: string; error: string; count: number }>();
    for (const e of this.#entries) {
      if (e.error) {
        const key = `${e.tool}:${e.error}`;
        const existing = errorMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          errorMap.set(key, { tool: e.tool, error: e.error, count: 1 });
        }
      }
    }

    const topErrors = [...errorMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      totalCalls: total,
      successRate: successCount / total,
      avgDuration,
      topErrors,
    };
  }

  /** Persist log to a JSON file */
  async saveToFile(path: string): Promise<void> {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path, this.toJSON(), 'utf-8');
  }

  /** Load log from a JSON file, replacing current entries */
  async loadFromFile(path: string): Promise<void> {
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(path, 'utf-8');
    const entries = JSON.parse(raw) as AuditEntry[];
    this.#entries = entries;
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
