import type { GenerationRecord } from '@/engine/training/records';
import { saveCheckpoint } from '@/storage/checkpoints';
import { saveGenerations, setGenerationBenchmark } from '@/storage/generations';
import { updateRun } from '@/storage/runs';
import { WriteQueue } from '@/storage/writeQueue';

/** Unsaved generations at which the lab shows "Saving" and asks before the tab closes. */
export const SAVE_BACKLOG = 10;

interface PendingCheckpoint {
  generation: number;
  state: unknown;
}

/**
 * Saves what training produces. Generations wait in a list and every
 * write takes all of them at once, so a backlog costs one transaction
 * rather than three per generation. Only the newest checkpoint of a run
 * waits: an older one that was never written is dropped. A write puts its
 * generations down before its checkpoints, so a checkpoint never lands
 * ahead of the history it follows.
 */
export class RunSaver {
  private generations: GenerationRecord[] = [];
  private checkpoints = new Map<string, PendingCheckpoint>();
  /** The queued write that will take whatever arrives next. Null once it starts. */
  private next: Promise<void> | null = null;
  /** Generations the running write is putting down. */
  private writing = 0;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly queue = new WriteQueue()) {}

  /** Generations handed over that are not on disk yet. */
  get backlog(): number {
    return this.generations.length + this.writing;
  }

  /** Queues a finished generation. Resolves once it is on disk. */
  generation(record: GenerationRecord): Promise<void> {
    this.generations.push(record);
    return this.schedule();
  }

  /** Queues a population checkpoint in place of any older one of the run still waiting. Resolves once it is on disk. */
  checkpoint(runId: string, generation: number, state: unknown): Promise<void> {
    this.checkpoints.set(runId, { generation, state });
    return this.schedule();
  }

  /**
   * Puts a benchmark score on a generation. It waits behind the writes
   * already queued, so a score for a generation still in the backlog lands
   * on its row once that row exists, instead of updating nothing.
   */
  benchmark(runId: string, generation: number, score: number): Promise<void> {
    return this.queue.push(async () => {
      await setGenerationBenchmark(runId, generation, score);
      await updateRun(runId, { benchmark: score });
    });
  }

  /** Calls `listener` whenever the backlog changes. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private schedule(): Promise<void> {
    this.notify();
    if (!this.next) this.next = this.queue.push(() => this.write());
    return this.next;
  }

  private async write(): Promise<void> {
    this.next = null;
    const generations = this.generations;
    const checkpoints = [...this.checkpoints];
    this.generations = [];
    this.checkpoints.clear();
    this.writing = generations.length;
    try {
      if (generations.length) await saveGenerations(generations);
      for (const [runId, c] of checkpoints) await saveCheckpoint(runId, c.generation, c.state);
    } finally {
      this.writing = 0;
      this.notify();
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
