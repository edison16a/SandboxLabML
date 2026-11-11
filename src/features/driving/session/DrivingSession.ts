import type { DrivingContent } from '@/engine/driving/run/content';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { EpisodeSession } from '@/features/lab/session/EpisodeSession';
import { isWatchSpeed } from '@/workers/shared/protocol';
import { enterSandbox, sandboxControls, scheduleSandboxScene, type SandboxControls } from '../sandbox/scene';
import { openedRunState, useDrivingLab, type DrivingLabState } from '../state/labStore';

/**
 * How long a ghost replay plays before Turbo may swap it, ms. Under Turbo a
 * generation ends every second or so, and each one moves the trips on;
 * restarting the replay with every one would never let a champion finish a
 * drive. Watch speeds swap it with every generation, in step with the
 * population.
 */
export const TURBO_SCENE_MS = 25_000;

/**
 * The Driving lab's session: the shared episode session, plus the content
 * the city on screen is built from (what training drives, and what the
 * ghost replay drives, which Turbo lets lag behind) and the Sandbox, where
 * champions or the shipped trained model drive any trip.
 */
export class DrivingSession extends EpisodeSession<DrivingLabState> {
  private sceneAt = -Infinity;
  private pending: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super('driving', useDrivingLab);
  }

  protected override beforeLoad(): void {
    if (this.pending) clearTimeout(this.pending);
    this.pending = null;
    this.sceneAt = -Infinity;
    this.set({ content: null, ghostContent: null });
  }

  protected override openedState(config: RunConfig, history: GenerationRecord[], generation: number): Partial<DrivingLabState> {
    return openedRunState(config, history, generation, this.store.mode);
  }

  protected override onContent(content: unknown): void {
    this.set({ content: content as DrivingContent });
  }

  /** The live content, as the default does, noted in the store so the viewport builds the ghosts' own streets. */
  protected override ghostContent(run: RunConfig, generations: readonly number[]): unknown {
    const content = super.ghostContent(run, generations) as DrivingContent;
    this.set({ ghostContent: content });
    return content;
  }

  /** As the shared refresh, but under Turbo a replay keeps playing for a while before a newer one replaces it. */
  override async refreshGhosts(force = false): Promise<void> {
    const s = this.store;
    const turbo = !isWatchSpeed(s.speed) && s.status === 'running' && s.mode === 'train';
    const wait = TURBO_SCENE_MS - (performance.now() - this.sceneAt);
    if (turbo && wait > 0) {
      if (!this.pending) {
        this.pending = setTimeout(() => {
          this.pending = null;
          void this.refreshGhosts(true);
        }, wait);
      }
      return;
    }
    if (turbo) this.sceneAt = performance.now();
    else this.sceneAt = -Infinity;
    await super.refreshGhosts(force);
  }

  /** Pauses training and opens the Sandbox, back to the trip and SUVs last set up there. */
  async enterSandbox(): Promise<void> {
    await enterSandbox(this, await this.init());
  }

  override async exitSandbox(): Promise<void> {
    this.set({ sandboxSetup: null, sandboxInputs: null, sandboxBrain: null, sandboxPaused: false });
    await super.exitSandbox();
  }

  /** Call after a lesion in the Sandbox. Trip and field changes go through `sandbox`. */
  override sandboxChanged(): void {
    if (this.pool) scheduleSandboxScene(this.pool);
  }

  /** Play, pause, restart, the trip and the SUVs of the Sandbox. Null until the workers are up. */
  get sandbox(): SandboxControls | null {
    return this.pool ? sandboxControls(this.pool) : null;
  }
}

let session: DrivingSession | null = null;

export function drivingSession(): DrivingSession {
  if (!session) session = new DrivingSession();
  return session;
}
