import type { StoreApi } from 'zustand';
import { loadEpisodeModule, requireEpisodeInfo } from '@/engine/env/registry';
import type { EnvId } from '@/engine/env/types';
import type { EpisodeTrainerState } from '@/engine/training/episodeTrainer';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { isRemoved, onRunsRemoved } from '@/storage/runEvents';
import { createRun, getRun } from '@/storage/runs';
import { createWorkerPool, type WorkerPool } from '@/workers/client/workerPool';
import { isWatchSpeed, WATCH_SPEEDS, type SpeedMode } from '@/workers/shared/protocol';
import { closedLabState, openedLabState, viewportHeld, withRecords, type LabState, type LabStoreApi } from '../state/labState';
import { maybeBenchmark } from './backgroundBench';
import { GhostSession } from './GhostSession';
import { guardPage } from './pageGuard';
import { restoreHistory } from './restoreRun';
import type { RunSaver } from './runSaver';
import { SessionEvents } from './sessionEvents';

/**
 * Main thread glue for a single population lab: owns the workers, saves
 * what the coordinator produces and keeps the ghost replay (GhostSession)
 * in step with training. One instance per lab lives for the whole browser
 * session, so training keeps going while the user looks at other pages. A
 * lab extends it through the protected hooks (its Sandbox, its own store
 * fields).
 */
export class EpisodeSession<S extends LabState = LabState> extends GhostSession<S> {
  private ready: Promise<WorkerPool> | null = null;
  /** Saves and batches what the coordinator sends (see sessionEvents.ts). */
  protected readonly events = new SessionEvents({
    lab: () => this.store,
    set: (patch) => this.set(patch as Partial<S>),
    deliver: (batch) => {
      const next = withRecords(this.store.records, batch);
      if (next) this.set(next as Partial<S>);
      // Benchmark once the records are in the store, so each score has a row to land on.
      if (this.pool) for (const r of batch) maybeBenchmark(this.pool, this.api as unknown as LabStoreApi, r);
      void this.refreshGhosts();
    },
    content: (content) => {
      this.content = content;
      this.onContent(content);
    },
    refreshGhosts: (force) => void this.refreshGhosts(force),
    playGhosts: (speed) => void this.playGhosts(speed, false),
  });

  constructor(env: EnvId, api: StoreApi<S>) {
    super(env, api);
  }

  /** Starts the workers and loads the env's module, which the ghost setup needs on this thread. */
  async init(): Promise<WorkerPool> {
    if (!this.ready) {
      guardPage({ saves: this.saves, training: () => this.store.status === 'running', saveNow: () => this.saveNow() });
      onRunsRemoved((removed) => {
        const run = this.store.run;
        if (run && isRemoved(removed, run.id)) void this.closeRun();
      });
      this.ready = Promise.all([createWorkerPool((e) => this.events.apply(e)), loadEpisodeModule(this.env)]).then(([p]) => (this.pool = p));
    }
    return this.ready;
  }

  get streams() {
    return this.pool ? { population: this.pool.population, ghosts: this.pool.ghosts } : null;
  }

  async newRun(config: RunConfig): Promise<void> {
    await createRun(config);
    await this.load(config, [], undefined);
  }

  async openRun(runId: string): Promise<boolean> {
    const run = await getRun(runId);
    if (!run || run.env !== this.env || run.deletedAt) return false;
    const { history, state } = await restoreHistory(runId);
    await this.load(run.config, history, state);
    return true;
  }

  protected async load(config: RunConfig, history: GenerationRecord[], state?: EpisodeTrainerState): Promise<void> {
    const pool = await this.init();
    await this.teardown(pool);
    const generation = await pool.coordinator.load(config, state);
    this.ghostKey = '';
    this.set(this.openedState(config, history, generation));
    await pool.coordinator.setSpeed(this.store.speed);
    await this.refreshGhosts();
  }

  /** Stops training and clears what the open run left in the workers and the lab. */
  private async teardown(pool: WorkerPool): Promise<void> {
    await pool.coordinator.pause();
    this.events.clear();
    pool.population.clear();
    pool.ghosts.clear();
    await pool.replay.stopGhosts();
    this.content = null;
    this.ghostKey = '';
    this.beforeLoad();
  }

  /**
   * The open run went to Trash or was deleted (see runEvents). Training
   * stops and the lab lets go of it, so the next visit opens another run.
   * A last checkpoint keeps a trashed run whole, should the user restore it.
   */
  private async closeRun(): Promise<void> {
    const pool = this.pool;
    if (!pool) return;
    await pool.coordinator.pause();
    await this.saveNow();
    await this.teardown(pool);
    this.set(closedLabState() as Partial<S>);
  }

  /** Clears lab fields that belong to the run being replaced. */
  protected beforeLoad(): void {}

  /** Store fields for a run that just opened. Labs add their own on top. */
  protected openedState(config: RunConfig, history: GenerationRecord[], generation: number): Partial<S> {
    return openedLabState(config, history, generation, requireEpisodeInfo(this.env).engineVersion, this.store.mode) as Partial<S>;
  }

  async start(generations?: number): Promise<void> {
    const pool = await this.init();
    if (!this.store.run) return;
    // Training always runs with the Sandbox closed, whichever button started it.
    if (this.store.mode === 'sandbox') await this.exitSandbox();
    await pool.coordinator.start(generations);
    if (this.store.speed === 'max') await pool.replay.stopGhosts();
    else await pool.replay.setGhostsPaused(false);
  }

  async pause(): Promise<void> {
    const pool = await this.init();
    await pool.coordinator.pause();
    if (isWatchSpeed(this.store.speed)) await pool.replay.setGhostsPaused(true);
    await this.saveNow();
  }

  async setSpeed(mode: SpeedMode): Promise<void> {
    const pool = await this.init();
    const wasWatch = isWatchSpeed(this.store.speed);
    const wasMax = this.store.speed === 'max';
    this.set({ speed: mode } as Partial<S>);
    await pool.coordinator.setSpeed(mode);
    if (isWatchSpeed(mode)) await pool.replay.setGhostSpeed(WATCH_SPEEDS[mode]);
    // A Sandbox replay carries on at real time under Turbo and Max; only training would use them.
    else if (this.store.mode === 'sandbox') await pool.replay.setGhostSpeed(1);
    else if (viewportHeld(this.store)) await pool.replay.stopGhosts();
    else if (wasMax) await this.refreshGhosts(true);
    else if (wasWatch) await this.playGhosts(1, true);
  }

  /** Saves a checkpoint right now: on pause, and when the tab is hidden mid training (see pageGuard). */
  async saveNow(): Promise<void> {
    const pool = this.pool;
    const run = this.store.run;
    if (!pool || !run) return;
    const state = await pool.coordinator.checkpoint();
    if (state) await this.events.saves.checkpoint(run.id, state.population.generation, state);
  }

  /** What is still waiting to be saved, for the lab's Saving chip and its guard on closing the tab. */
  get saves(): RunSaver {
    return this.events.saves;
  }

  /** Leaves the Sandbox and brings the training ghosts back. Labs with a Sandbox reset their own fields too. */
  async exitSandbox(): Promise<void> {
    this.set({ mode: 'train', lesions: {}, view: 'both' } as Partial<S>);
    this.ghostKey = '';
    await this.refreshGhosts(true);
  }
}
