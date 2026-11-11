import type { EpisodeSetup } from '@/engine/env/episode';
import type { NavigationContent } from '@/engine/navigation/pipeline/content';
import type { NavigationSetup } from '@/engine/navigation/pipeline/setup';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { EpisodeSession } from '@/features/lab/session/EpisodeSession';
import type { WorkerPool } from '@/workers/client/workerPool';
import { isWatchSpeed, WATCH_SPEEDS } from '@/workers/shared/protocol';
import { openedNavigationState, openedSandbox, useNavigationLab, type NavigationLabState } from '../state/labStore';
import { GhostPacing } from './ghostPacing';
import { SandboxControl } from './sandboxControl';

/**
 * The Navigation lab's session: the shared episode session plus the
 * content (level and courses) the population trains on, mirrored into the
 * store, and a calmer ghost replay. Ghosts replay on the course the
 * population runs now, only that one course, and under Turbo each replay
 * plays out before the next champion takes over.
 */
export class NavigationSession extends EpisodeSession<NavigationLabState> {
  private readonly pacing = new GhostPacing(() => void super.refreshGhosts(true));
  private listening = false;
  /** The Sandbox, once the workers are up. */
  sandbox: SandboxControl | null = null;

  constructor() {
    super('navigation', useNavigationLab);
    // Switching to the ghosts alone while a generation plays brings a replay back at once, looping (see playGhosts).
    useNavigationLab.subscribe((s, prev) => {
      if (s.view === 'overlay' && prev.view !== 'overlay' && s.status === 'running' && s.mode === 'train' && isWatchSpeed(s.speed)) void this.playGhosts(WATCH_SPEEDS[s.speed], true);
    });
  }

  override async init(): Promise<WorkerPool> {
    const pool = await super.init();
    if (!this.listening) {
      this.listening = true;
      pool.ghosts.on(this.pacing.listen);
      this.sandbox = new SandboxControl(pool, () => this.pause());
    }
    return pool;
  }

  /** Opens the Sandbox, starting the workers first if the lab has not yet. */
  async enterSandbox(): Promise<void> {
    await this.init();
    await this.sandbox?.enter();
  }

  override async exitSandbox(): Promise<void> {
    this.store.setSandbox({ inputs: null, lineup: null, paused: false });
    this.set({ viewSchema: null });
    await super.exitSandbox();
  }

  /** A lesion or an edit changed the scene, so the Sandbox plays it again. */
  override sandboxChanged(): void {
    this.sandbox?.schedule();
  }

  protected override beforeLoad(): void {
    this.pacing.reset();
    this.set({ content: null });
  }

  protected override openedState(config: RunConfig, history: GenerationRecord[], generation: number): Partial<NavigationLabState> {
    return { ...openedNavigationState(config, history, generation, this.store.mode), sandbox: openedSandbox(this.store.sandbox), viewSchema: null };
  }

  protected override onContent(content: unknown): void {
    this.set({ content: content as NavigationContent });
  }

  /** Only the shown course: a ghost's other courses would run unseen. */
  protected override ghostSetup(run: RunConfig, generations: readonly number[]): EpisodeSetup {
    const setup = super.ghostSetup(run, generations) as NavigationSetup;
    const shown: NavigationSetup = { ...setup, courses: setup.courses.slice(0, 1) };
    return shown;
  }

  /**
   * A champion's run is over long before a generation's slowest runner,
   * so with only the ghosts on screen the replay loops rather than leave
   * an empty room until the next generation starts it again.
   */
  protected override async playGhosts(speed: number, loop: boolean): Promise<void> {
    await super.playGhosts(speed, loop || this.store.view === 'overlay');
  }

  override async refreshGhosts(force = false): Promise<void> {
    const s = this.store;
    if (s.status === 'running' && s.speed === 'turbo' && s.mode === 'train' && this.pacing.hold()) return;
    await super.refreshGhosts(force);
  }
}

let session: NavigationSession | null = null;

export function navigationSession(): NavigationSession {
  if (!session) session = new NavigationSession();
  return session;
}
