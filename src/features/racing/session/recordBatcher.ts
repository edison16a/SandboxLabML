import type { GenerationRecord } from '@/engine/training/records';

/**
 * Hands finished generations to the lab store at most a few times a second.
 * On Turbo and Max several generations can finish each second, and every
 * store update repaints each chart. On a weak or software GPU those repaints
 * queue up behind each other until the page stops responding. A record that
 * arrives after a quiet spell still shows at once; only bursts are grouped.
 */
export class RecordBatcher {
  private pending: GenerationRecord[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = -Infinity;

  constructor(
    private readonly deliver: (batch: GenerationRecord[]) => void,
    private readonly gapMs = 500,
  ) {}

  push(record: GenerationRecord): void {
    this.pending.push(record);
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), Math.max(0, this.last + this.gapMs - performance.now()));
  }

  /** Delivers whatever is waiting now, e.g. before the run pauses or changes. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending.length) return;
    const batch = this.pending;
    this.pending = [];
    this.last = performance.now();
    this.deliver(batch);
  }

  /** Drops waiting records, for when another run is loaded. */
  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = [];
  }
}
