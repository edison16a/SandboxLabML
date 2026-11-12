import type { GenerationRecord } from '@/engine/training/records';
import { saveCheckpoint } from '@/storage/checkpoints';
import { saveGeneration } from '@/storage/generations';
import { WriteQueue } from '@/storage/writeQueue';
import { toast } from '@/ui/toast/toastStore';
import type { CoordinatorEvent } from '@/workers/coordinator/events';
import { viewportHeld, type LabState } from '../state/labState';
import { RecordBatcher } from './recordBatcher';

/**
 * The parts of a lab's session that the coordinator's events touch, as
 * closures, so EpisodeSession keeps its fields protected and this file
 * holds only what each event means.
 */
export interface SessionEventHooks {
  lab(): LabState;
  set(patch: Partial<LabState>): void;
  /** Takes a batch of finished records into the store. */
  deliver(batch: GenerationRecord[]): void;
  /** Takes the new content (Navigation: the next course) and lets the lab mirror it. */
  content(content: unknown): void;
  refreshGhosts(force: boolean): void;
  /** Restarts the ghosts once, at a watch speed. */
  playGhosts(speed: number): void;
}

/**
 * Applies coordinator events to a lab: its store, its saved run and its
 * ghosts. Saves go through one queue, so they land in the order they were
 * asked for, and records reach the store in batches (see RecordBatcher).
 */
export class SessionEvents {
  readonly writes = new WriteQueue();
  private readonly batcher: RecordBatcher;

  constructor(private readonly h: SessionEventHooks) {
    this.batcher = new RecordBatcher((batch) => h.deliver(batch));
  }

  /** Drops records still waiting, when another run opens. */
  clear(): void {
    this.batcher.clear();
  }

  apply(e: CoordinatorEvent): void {
    const h = this.h;
    const run = h.lab().run;
    switch (e.type) {
      case 'status': {
        this.batcher.flush();
        const held = viewportHeld(h.lab());
        h.set({ status: e.status });
        // Max held the ghosts while it trained. Once it stops, the viewport wakes and they come back.
        if (held && !viewportHeld(h.lab())) h.refreshGhosts(true);
        break;
      }
      case 'generation':
        this.batcher.push(e.record);
        void this.writes.push(() => saveGeneration(e.record));
        break;
      case 'checkpoint':
        if (run) void this.writes.push(() => saveCheckpoint(run.id, e.generation, e.state));
        break;
      case 'content':
        h.content(e.content);
        h.refreshGhosts(true);
        break;
      case 'live-start':
        h.set({ liveGeneration: e.generation });
        if (h.lab().mode === 'sandbox') break;
        // Ghosts restart with every live generation so they run beside the new agents from the same start.
        h.playGhosts(e.speed);
        break;
      case 'error':
        h.set({ status: 'error' });
        toast.error('Training stopped', e.message);
        break;
    }
  }
}
