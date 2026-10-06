import type { MatchControllers } from '@/engine/hideseek/match/types';
import { hideSeekControllers, safeHideSeekHost } from '@/engine/training/hideseekSetup';
import type { ScriptHost } from '@/engine/training/scriptHost';

/**
 * Compiles a run's script once per worker and hands out fresh controllers
 * per match, seeded with the match seed so `rand()` in a script plays the
 * same in training, the live grid and every replay.
 */
export class HideSeekHostCache {
  private cached: { source: string | null; host: ScriptHost; error: string | null } | null = null;

  host(source: string | null): ScriptHost {
    if (!this.cached || this.cached.source !== source) this.cached = { source, ...safeHideSeekHost(source) };
    return this.cached.host;
  }

  /** Why the script fell back to built-in rewards, or null when it compiled (or there is none). */
  error(source: string | null): string | null {
    this.host(source);
    return this.cached?.error ?? null;
  }

  controllers(source: string | null, seed: number): MatchControllers {
    return hideSeekControllers(this.host(source), seed);
  }
}
