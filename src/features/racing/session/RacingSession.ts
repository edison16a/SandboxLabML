import { ENGINE_VERSION } from '@/engine/core/version';
import type { RacingTrainerState } from '@/engine/training/racingTrainer';
import type { GenerationRecord } from '@/engine/training/records';
import { racingSetupFor } from '@/engine/training/racingSetup';
import type { RunConfig } from '@/engine/training/runConfig';
import { saveCheckpoint } from '@/storage/checkpoints';
import { saveGeneration } from '@/storage/generations';
import { WriteQueue } from '@/storage/writeQueue';
import { createRun, getRun } from '@/storage/runs';
import { toast } from '@/ui/toast/toastStore';
import { createWorkerPool, type WorkerPool } from '@/workers/client/workerPool';
import type { CoordinatorEvent } from '@/workers/coordinator/events';
import { isWatchSpeed, WATCH_SPEEDS, type SpeedMode } from '@/workers/shared/protocol';
import { useRacingLab, viewportHeld } from '../state/labStore';
import { ghostSpecs, selectGhosts } from './ghostSelection';
import { enterSandbox, scheduleSandboxScene } from './sandbox';
import { maybeBenchmark } from './backgroundBench';
import { RecordBatcher } from './recordBatcher';
import { restoreRacingHistory } from './restoreRun';

/**
 * Main-thread glue for the Racing lab: owns the workers, saves what the
 * coordinator produces, and keeps the ghost replay in step with training.
 * One instance lives for the whole browser session, so training keeps going
 * while the user looks at other pages.
 */
export class RacingSession {
  private pool: WorkerPool | null = null;
  private ready: Promise<WorkerPool> | null = null;
  private ghostKey = '';
  private readonly writes = new WriteQueue();
  private readonly batcher = new RecordBatcher((batch) => {
    this.store.addRecords(batch);
    // Benchmark once the records are in the store, so each score has a row to land on.
    if (this.pool) for (const r of batch) maybeBenchmark(this.pool, r);
    void this.refreshGhosts();
  });

  async init(): Promise<WorkerPool> {
    if (!this.ready) this.ready = createWorkerPool((e) => this.onEvent(e)).then((p) => (this.pool = p));
    return this.ready;
  }

  get streams() {
    return this.pool ? { population: this.pool.population, ghosts: this.pool.ghosts } : null;
  }

  private get store() {
    return useRacingLab.getState();
  }

  async newRun(config: RunConfig): Promise<void> {
    await createRun(config);
    await this.load(config, [], undefined);
  }

  async openRun(runId: string): Promise<boolean> {
    const run = await getRun(runId);
    if (!run || run.env !== 'racing' || run.deletedAt) return false;
    const { history, state } = await restoreRacingHistory(runId);
    await this.load(run.config, history, state);
    return true;
  }

  private async load(config: RunConfig, history: GenerationRecord[], state?: RacingTrainerState) {
    const pool = await this.init();
    await pool.coordinator.pause();
    this.batcher.clear();
    pool.population.clear();
    pool.ghosts.clear();
    await pool.replay.stopGhosts();
    this.store.set({ trackSpec: null });
    const generation = await pool.coordinator.loadRacing(config, state);
    this.ghostKey = '';
    this.store.set({
      run: config,
      records: history,
      liveGeneration: generation,
      status: 'idle',
      replayBlocked: config.engineVersion === ENGINE_VERSION ? null : 'This run was trained on an older engine, so its generations cannot be replayed.',
      focus: { kind: 'champion' },
      networkGeneration: null,
      telemetry: [],
      ghostGenerations: [],
    });
    await pool.coordinator.setSpeed(this.store.speed);
    await this.refreshGhosts();
  }

  async start(generations?: number): Promise<void> {
    const pool = await this.init();
    if (!this.store.run) return;
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
    this.store.set({ speed: mode });
    await pool.coordinator.setSpeed(mode);
    if (isWatchSpeed(mode)) await pool.replay.setGhostSpeed(WATCH_SPEEDS[mode]);
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

  /** Switches to the Sandbox: champions replay on an editable copy of the track. */
  async enterSandbox(): Promise<void> {
    await enterSandbox(this, await this.init());
  }

  async exitSandbox(): Promise<void> {
    this.store.set({ mode: 'train', editingTrack: false, lesions: {}, selectedHandle: null, view: 'both' });
    this.ghostKey = '';
    await this.refreshGhosts(true);
  }

  /** Call after any Sandbox change (track edit, lesion, ghost selection). */
  sandboxChanged(): void {
    if (this.pool) scheduleSandboxScene(this.pool);
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
    const track = this.store.trackSpec ?? run.racing!.track;
    await pool.replay.setGhostScene(racingSetupFor(run, track, null), ghostSpecs(run, records, gens));
    this.store.set({ ghostGenerations: gens });
    if (!isWatchSpeed(speed) || this.store.status !== 'running') await this.playGhosts(isWatchSpeed(speed) ? WATCH_SPEEDS[speed] : 1, true);
    const telemetry = await pool.replay.ghostTelemetry();
    this.store.set({ telemetry });
  }

  private async playGhosts(speed: number, loop: boolean): Promise<void> {
    await this.pool?.replay.playGhosts(speed, loop);
  }

  private onEvent(e: CoordinatorEvent): void {
    const run = this.store.run;
    switch (e.type) {
      case 'status': {
        this.batcher.flush();
        const held = viewportHeld(this.store);
        this.store.set({ status: e.status });
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
      case 'track':
        this.store.set({ trackSpec: e.spec });
        void this.refreshGhosts(true);
        break;
      case 'live-start':
        this.store.set({ liveGeneration: e.generation });
        if (this.store.mode === 'sandbox') break;
        // Ghosts restart with every live generation so they race the new cars from the same line.
        void this.playGhosts(e.speed, false);
        break;
      case 'error':
        this.store.set({ status: 'error' });
        toast.error('Training stopped', e.message);
        break;
    }
  }
}

let session: RacingSession | null = null;

export function racingSession(): RacingSession {
  if (!session) session = new RacingSession();
  return session;
}
