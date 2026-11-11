import type { TrackSpec } from '@/engine/racing/track/types';
import type { RacingRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import type { WorkerPool } from '@/workers/client/workerPool';
import { EpisodeSession } from '@/features/lab/session/EpisodeSession';
import { openedRunState, useRacingLab, type RacingLabState } from '../state/labStore';
import { enterSandbox, sandboxControls, scheduleSandboxScene, type SandboxControls } from './sandbox';

/**
 * The Racing lab's session: the shared episode session plus the track the
 * cars drive on, their speed traces and the Sandbox, where stored
 * champions race on any track.
 */
export class RacingSession extends EpisodeSession<RacingLabState> {
  constructor() {
    super('racing', useRacingLab);
  }

  protected override beforeLoad(): void {
    this.set({ trackSpec: null });
  }

  protected override openedState(config: RunConfig, history: RacingRecord[], generation: number): Partial<RacingLabState> {
    return openedRunState(config, history, generation, this.store.mode);
  }

  protected override onContent(content: unknown): void {
    this.set({ trackSpec: content as TrackSpec });
  }

  protected override async afterGhosts(pool: WorkerPool): Promise<void> {
    const telemetry = await pool.replay.ghostTelemetry();
    this.set({ telemetry, telemetryTrack: null });
  }

  /** Switches to the Sandbox, back to the track and field last set up there. */
  async enterSandbox(): Promise<void> {
    await enterSandbox(this, await this.init());
  }

  override async exitSandbox(): Promise<void> {
    this.set({ editingTrack: false, selectedHandle: null });
    await super.exitSandbox();
  }

  /** Call after a track edit or lesion in the Sandbox. Field and gallery changes go through `sandbox`. */
  override sandboxChanged(): void {
    if (this.pool) scheduleSandboxScene(this.pool);
  }

  /** Play, pause, restart, track and field for the Sandbox. Null until the workers are up. */
  get sandbox(): SandboxControls | null {
    return this.pool ? sandboxControls(this.pool) : null;
  }
}

let session: RacingSession | null = null;

export function racingSession(): RacingSession {
  if (!session) session = new RacingSession();
  return session;
}
