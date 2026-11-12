import type { StoreApi } from 'zustand';
import type { EpisodeSetup } from '@/engine/env/episode';
import { requireEpisodeModule } from '@/engine/env/registry';
import type { EnvId } from '@/engine/env/types';
import type { RunConfig } from '@/engine/training/runConfig';
import type { WorkerPool } from '@/workers/client/workerPool';
import { isWatchSpeed, WATCH_SPEEDS } from '@/workers/shared/protocol';
import { viewportHeld, type LabState } from '../state/labState';
import { ghostSpecs, selectGhosts } from './ghostSelection';

/**
 * The ghost replay half of a lab session: which past champions replay,
 * on what content, and when the replay restarts. EpisodeSession builds
 * the workers and the run lifecycle on top. A lab tunes the replay
 * through the protected hooks (Driving: its own streets for the ghosts;
 * Navigation: only the shown course).
 */
export abstract class GhostSession<S extends LabState = LabState> {
  protected pool: WorkerPool | null = null;
  protected ghostKey = '';
  /** What the population trains on, from the coordinator. Null until the run loads. */
  protected content: unknown = null;

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

  /** Call after a lesion or a Sandbox edit. Labs with a Sandbox resend its scene. */
  sandboxChanged(): void {}

  /**
   * What ghosts replay on. By default it is the content training is on
   * now, so old champions run beside the new agents on the same course. A lab
   * that wants a champion's own episode returns the content its record
   * kept (see contentOnRecords). Every ghost of a scene shares it.
   */
  protected ghostContent(run: RunConfig, _generations: readonly number[]): unknown {
    return this.content ?? requireEpisodeModule(this.env).initialContent(run);
  }

  /** The setup ghosts replay on, built from ghostContent. */
  protected ghostSetup(run: RunConfig, generations: readonly number[]): EpisodeSetup {
    return requireEpisodeModule(this.env).createSetup({ config: run, content: this.ghostContent(run, generations), scriptSource: null });
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
    await pool.replay.setGhostScene(this.env, this.ghostSetup(run, gens), ghostSpecs(run, records, gens));
    this.set({ ghostGenerations: gens } as Partial<S>);
    if (!isWatchSpeed(speed) || this.store.status !== 'running') await this.playGhosts(isWatchSpeed(speed) ? WATCH_SPEEDS[speed] : 1, true);
    await this.afterGhosts(pool);
  }

  /** Runs once a new ghost scene plays, for a lab that fetches something per scene. */
  protected async afterGhosts(_pool: WorkerPool): Promise<void> {}

  protected async playGhosts(speed: number, loop: boolean): Promise<void> {
    await this.pool?.replay.playGhosts(speed, loop);
  }

  /** The content changed (Driving: the curriculum moved up a level). Labs mirror it into their store. */
  protected onContent(_content: unknown): void {}
}
