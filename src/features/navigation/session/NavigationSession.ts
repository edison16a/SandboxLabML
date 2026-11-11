import type { EpisodeSetup } from '@/engine/env/episode';
import type { NavigationContent } from '@/engine/navigation/pipeline/content';
import type { NavigationSetup } from '@/engine/navigation/pipeline/setup';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { EpisodeSession } from '@/features/lab/session/EpisodeSession';
import type { WorkerPool } from '@/workers/client/workerPool';
import { openedNavigationState, useNavigationLab, type NavigationLabState } from '../state/labStore';
import { GhostPacing } from './ghostPacing';

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

  constructor() {
    super('navigation', useNavigationLab);
  }

  override async init(): Promise<WorkerPool> {
    const pool = await super.init();
    if (!this.listening) {
      this.listening = true;
      pool.ghosts.on(this.pacing.listen);
    }
    return pool;
  }

  protected override beforeLoad(): void {
    this.pacing.reset();
    this.set({ content: null });
  }

  protected override openedState(config: RunConfig, history: GenerationRecord[], generation: number): Partial<NavigationLabState> {
    return openedNavigationState(config, history, generation, this.store.mode);
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
