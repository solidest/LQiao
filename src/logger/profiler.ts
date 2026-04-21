/** Timing record */
export interface TimingRecord {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

/**
 * Performance profiler — records timing metrics for tool calls and model responses.
 */
export class Profiler {
  #records: TimingRecord[] = [];
  #startTimes = new Map<string, number>();

  /** Start timing an operation */
  start(name: string): void {
    this.#startTimes.set(name, performance.now());
  }

  /** Stop timing and record */
  stop(name: string): TimingRecord | null {
    const startTime = this.#startTimes.get(name);
    if (startTime === undefined) return null;

    const endTime = performance.now();
    const record: TimingRecord = {
      name,
      duration: endTime - startTime,
      startTime,
      endTime,
    };
    this.#records.push(record);
    this.#startTimes.delete(name);
    return record;
  }

  /** Get all timing records */
  getRecords(): ReadonlyArray<TimingRecord> {
    return [...this.#records];
  }

  /** Get average duration for a named operation */
  average(name: string): number | null {
    const records = this.#records.filter((r) => r.name === name);
    if (records.length === 0) return null;
    return records.reduce((sum, r) => sum + r.duration, 0) / records.length;
  }

  /** Get max duration for a named operation */
  max(name: string): number | null {
    const records = this.#records.filter((r) => r.name === name);
    if (records.length === 0) return null;
    return Math.max(...records.map((r) => r.duration));
  }

  /** Clear all records */
  clear(): void {
    this.#records = [];
    this.#startTimes.clear();
  }
}
