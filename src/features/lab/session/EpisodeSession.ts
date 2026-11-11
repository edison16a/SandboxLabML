import type { StoreApi } from 'zustand';
import type { EpisodeSetup } from '@/engine/env/episode';
import { requireEpisodeModule } from '@/engine/env/registry';
import type { EnvId } from '@/engine/env/types';
import type { EpisodeTrainerState } from '@/engine/training/episodeTrainer';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { saveCheckpoint } from '@/storage/checkpoints';
import { saveGeneration } from '@/storage/generations';
import { createRun, getRun } from '@/storage/runs';
import { WriteQueue } from '@/storage/writeQueue';
import { toast } from '@/ui/toast/toastStore';
import { createWorkerPool, type WorkerPool } from '@/workers/client/workerPool';
import type { CoordinatorEvent } from '@/workers/coordinator/events';
import { isWatchSpeed, WATCH_SPEEDS, type SpeedMode } from '@/workers/shared/protocol';
import { openedLabState, viewportHeld, withRecords, type LabState, type LabStoreApi } from '../state/labState';
import { maybeBenchmark } from './backgroundBench';
import { ghostSpecs, selectGhosts } from './ghostSelection';
import { RecordBatcher } from './recordBatcher';
import { restoreHistory } from './restoreRun';

/**
 * Main thread glue for a single population lab: owns the workers, saves
 * what the coordinator produces and keeps the ghost replay in step with
 * training. One instance per lab lives for the whole browser session, so
 * training keeps going while the user looks at other pages. A lab extends
 * it through the protected hooks (its Sandbox, its own store fields).
 */
export class EpisodeSession<S extends LabState = LabState> {
  protected pool: WorkerPool | null = null;
  private ready: Promise<WorkerPool> | null = null;
  protected ghostKey = '';
  /** What the population trains on, from the coordinator. Null until the run loads. */
  protected content: unknown = null;
  protected readonly writes = new WriteQueue();
  private readonly batcher = new RecordBatcher((batch) => {
    const next = withRecords(this.store.records, batch);
    if (next) this.set(next as Partial<S>);
    // Benchmark once the records are in the store, so each score has a row to land on.
    if (this.pool) for (const r of batch) maybeBenchmark(this.pool, this.api as unknown as LabStoreApi, r);
    void this.refreshGhosts();
  });

  constructor(
    readonly env: EnvId,
    protected readonly api: StoreApi<S>,
  ) {}

  protected get store(): S {
    return this.api.getState();
  }

  protected set(patch: Partial<S>): void {
    this.api.setState(patch);
  }

  async init(): Promise<WorkerPool> {
    if (!this.ready) this.ready = createWorkerPool((e) => this.onEvent(e)).then((p) => (this.pool = p));
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
    await pool.coordinator.pause();
    this.batcher.clear();
    pool.population.clear();
    pool.ghosts.clear();
    await pool.replay.stopGhosts();
    this.content = null;
    this.beforeLoad();
    const generation = await pool.coordinator.load(config, state);
    this.ghostKey = '';
    this.set(this.openedState(config, history, generation));
    await pool.coordinator.setSpeed(this.store.speed);
    await this.refreshGhosts();
  }

  /** Clears lab fields that belong to the run being replaced. */
  protected beforeLoad(): void {}

  /** Store fields for a run that just opened. Labs add their own on top. */
  protected openedState(config: RunConfig, history: GenerationRecord[], generation: number): Partial<S> {
    return openedLabState(config, history, generation, requireEpisodeModule(this.env).engineVersion, this.store.mode) as Partial<S>;
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

  /** Saves a checkpoint right now, e.g. on pause or when the tab is hidden. */
  async saveNow(): Promise<void> {
    const pool = this.pool;
    const run = this.store.run;
    if (!pool || !run) return;
    const state = await pool.coordinator.checkpoint();
    if (state) await this.writes.push(() => saveCheckpoint(run.id, state.population.generation, state));
  }

  /** Leaves the Sandbox and brings the training ghosts back. Labs with a Sandbox reset their own fields too. */
  async exitSandbox(): Promise<void> {
    this.set({ mode: 'train', lesions: {}, view: 'both' } as Partial<S>);
    this.ghostKey = '';
    await this.refreshGhosts(true);
  }

  /** Call after a lesion or a Sandbox edit. Labs with a Sandbox resend its scene. */
  sandboxChanged(): void {}

  /** The setup ghosts replay on: the content training is on now, at the live generation. */
  protected ghostSetup(run: RunConfig): EpisodeSetup {
    const envModule = requireEpisodeModule(this.env);
    const content = this.content ?? envModule.initialContent(run);
    return envModule.createSetup({ config: run, content, generation: this.store.liveGeneration, scriptSource: null });
  }

  /** Rebuilds the ghost list from the current selection and restarts the replay if it changed. */
  async refreshGhosts(force = false): Promise<void> {
    const pool = this.pool;
    const { run, records, ghostSelection, replayBlocked, speed, mode } = this.store;
    if (!pool || !run || replayBlocked || viewportHeld(this.store)) return;
    if (mode === 'sandbox') return this.sandboxChanged();
    const gens = selectGhosts(ghostSelection, records.length);
    const key = `${run.id}:${gens.join(',')}`;
    if (key === this.ghostKey && !force) return;
    this.ghostKey = key;
    await pool.replay.setGhostScene(this.env, this.ghostSetup(run), ghostSpecs(run, records, gens));
    this.set({ ghostGenerations: gens } as Partial<S>);
    if (!isWatchSpeed(speed) || this.store.status !== 'running') await this.playGhosts(isWatchSpeed(speed) ? WATCH_SPEEDS[speed] : 1, true);
    await this.afterGhosts(pool);
  }

  /** Runs once a new ghost scene plays, such as Racing fetching its speed traces. */
  protected async afterGhosts(_pool: WorkerPool): Promise<void> {}

  protected async playGhosts(speed: number, loop: boolean): Promise<void> {
    await this.pool?.replay.playGhosts(speed, loop);
  }

  /** The content changed (Racing: a script switched the track). Labs mirror it into their store. */
  protected onContent(_content: unknown): void {}

  private onEvent(e: CoordinatorEvent): void {
    const run = this.store.run;
    switch (e.type) {
      case 'status': {
        this.batcher.flush();
        const held = viewportHeld(this.store);
        this.set({ status: e.status } as Partial<S>);
        // Max held the ghosts while it trained. Once it stops, the viewport wakes and they come back.
        if (held && !viewportHeld(this.store)) void this.refreshGhosts(true);
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
        this.content = e.content;
        this.onContent(e.content);
        void this.refreshGhosts(true);
        break;
      case 'live-start':
        this.set({ liveGeneration: e.generation } as Partial<S>);
        if (this.store.mode === 'sandbox') break;
        // Ghosts restart with every live generation so they race the new agents from the same start.
        void this.playGhosts(e.speed, false);
        break;
      case 'error':
        this.set({ status: 'error' } as Partial<S>);
        toast.error('Training stopped', e.message);
        break;
    }
  }
}
