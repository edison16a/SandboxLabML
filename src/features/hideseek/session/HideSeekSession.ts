import type { HideSeekTrainerState } from '@/engine/hideseek/trainer/types';
import type { HideSeekRecord, RoundReplay } from '@/engine/training/hideseekRecords';
import type { RunConfig } from '@/engine/training/runConfig';
import { saveCheckpoint } from '@/storage/checkpoints';
import { saveHideSeekGeneration } from '@/storage/hideSeekGenerations';
import { createRun } from '@/storage/runs';
import { toast } from '@/ui/toast/toastStore';
import type { ArenaFeed } from '@/workers/client/arenaFeed';
import { createHideSeekPool, type HideSeekPool } from '@/workers/client/hideSeekPool';
import type { HideSeekEvent } from '@/workers/coordinator/hideSeekEvents';
import type { SpeedMode } from '@/workers/shared/protocol';
import { useHideSeekLab } from '../state/hideSeekStore';
import { ReplayDirector } from './replayDirector';
import { loadHideSeekRun, replayBlockedReason, splitReplays } from './runLoader';
import { SandboxControl } from './sandboxControl';

/**
 * Main-thread glue for the Hide and Seek lab: owns the workers, saves what
 * the coordinator produces and decides what the viewport shows. One
 * instance lives for the whole browser session, so training keeps going
 * while the user looks at other pages.
 */
export class HideSeekSession {
  private pool: HideSeekPool | null = null;
  private ready: Promise<HideSeekPool> | null = null;
  private director: ReplayDirector | null = null;
  private sandboxControl: SandboxControl | null = null;

  async init(): Promise<HideSeekPool> {
    if (!this.ready) {
      this.ready = createHideSeekPool((e) => this.onEvent(e)).then((p) => {
        this.director = new ReplayDirector(p);
        this.sandboxControl = new SandboxControl(p);
        return (this.pool = p);
      });
    }
    return this.ready;
  }

  get streams(): { live: ArenaFeed; replayed: ArenaFeed } | null {
    return this.pool ? { live: this.pool.live, replayed: this.pool.replayed } : null;
  }

  /** The stream the viewport reads right now. */
  feed(): ArenaFeed | null {
    const streams = this.streams;
    if (!streams) return null;
    return this.store.source === 'replay' ? streams.replayed : streams.live;
  }

  get sandbox(): SandboxControl | null {
    return this.sandboxControl;
  }

  private get store() {
    return useHideSeekLab.getState();
  }

  async newRun(config: RunConfig): Promise<void> {
    await createRun(config);
    await this.load(config, [], null);
  }

  async openRun(runId: string): Promise<boolean> {
    const loaded = await loadHideSeekRun(runId);
    if (!loaded) return false;
    await this.load(loaded.config, loaded.history, loaded.latestReplay, loaded.state);
    return true;
  }

  private async load(config: RunConfig, history: HideSeekRecord[], latest: RoundReplay | null, state?: HideSeekTrainerState): Promise<void> {
    const pool = await this.init();
    await pool.coordinator.pauseHideSeek();
    await pool.replay.stopSandbox();
    this.director?.reset(latest);
    pool.live.clear();
    const generation = await pool.coordinator.loadHideSeek(config, state);
    const last = history[history.length - 1];
    this.store.set({
      run: config,
      records: history,
      liveGeneration: generation,
      status: 'idle',
      round: null,
      source: 'live',
      replayOf: null,
      replaying: false,
      replayBlocked: replayBlockedReason(config),
      mode: 'train',
      focus: null,
      networkGeneration: null,
    });
    if (last) this.store.setSandbox({ hiderGeneration: last.generation, seekerGeneration: last.generation, lesions: [] });
    await pool.coordinator.setHideSeekSpeed(this.store.speed);
    this.director?.update();
  }

  async start(generations?: number): Promise<void> {
    const pool = await this.init();
    if (!this.store.run) return;
    if (this.store.mode === 'sandbox') await this.exitSandbox();
    await pool.coordinator.startHideSeek(generations);
  }

  /** The Sandbox shares the replay worker with Turbo replays, so the replay stops first. */
  async enterSandbox(): Promise<void> {
    await this.init();
    this.director?.stop();
    await this.sandboxControl?.enter();
  }

  async exitSandbox(): Promise<void> {
    await this.sandboxControl?.exit();
    this.director?.update();
  }

  async pause(): Promise<void> {
    const pool = await this.init();
    await pool.coordinator.pauseHideSeek();
    await this.saveNow();
  }

  async setSpeed(mode: SpeedMode): Promise<void> {
    const pool = await this.init();
    this.store.set({ speed: mode });
    await pool.coordinator.setHideSeekSpeed(mode);
    this.director?.update();
  }

  /** Saves a checkpoint right now, e.g. on pause or when the tab is hidden. */
  async saveNow(): Promise<void> {
    const pool = this.pool;
    const run = this.store.run;
    if (!pool || !run) return;
    const state = await pool.coordinator.checkpointHideSeek();
    if (state) await saveCheckpoint(run.id, state.hiders.generation, state);
  }

  private onEvent(e: HideSeekEvent): void {
    const run = this.store.run;
    switch (e.type) {
      case 'status':
        this.store.set({ status: e.status });
        break;
      case 'round': {
        const info = { generation: e.generation, round: e.round, rounds: e.rounds, layout: e.layout, matches: e.matches, live: e.live };
        this.store.set({ round: info, liveGeneration: e.generation });
        this.director?.onRound(info);
        break;
      }
      case 'generation': {
        void saveHideSeekGeneration(e.record);
        const { records, latest } = splitReplays([e.record]);
        this.store.addRecord(records[0]);
        this.director?.offer(latest ?? undefined);
        break;
      }
      case 'checkpoint':
        if (run) void saveCheckpoint(run.id, e.generation, e.state);
        break;
      case 'notice':
        toast.info('Heads up', e.message);
        break;
      case 'error':
        this.store.set({ status: 'error' });
        toast.error('Training stopped', e.message);
        break;
    }
  }
}

let session: HideSeekSession | null = null;

export function hideSeekSession(): HideSeekSession {
  if (!session) session = new HideSeekSession();
  return session;
}
