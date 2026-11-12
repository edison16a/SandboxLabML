import { mixSeed } from '@/engine/core/rng';
import type { AnyEpisodeModule, EpisodeSetup } from '@/engine/env/episode';
import { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';
import { hostFor } from '@/engine/training/scriptHost';
import type { GhostGroup } from './ghostFrames';

export interface GhostSpec {
  generation: number;
  genome: Genome;
  seed: number;
  scriptSource: string | null;
  /** Start grid slot. Left out, the ghost starts where it trained. */
  slot?: number;
}

/** Salt of a ghost's controller seed. Script rand() in a tick draws from the agent's own stream, so it does not change a run. */
const GHOST_CONTROLLER_SALT = 0x9405;

/**
 * The envs a ghost scene runs in: one per script version, each holding the
 * ghosts trained under it. The replay and a rehearsal both build their
 * envs here, so a rehearsed scene plays out exactly as it will on screen.
 */
export function ghostGroups(module: AnyEpisodeModule, setup: EpisodeSetup, ghosts: readonly GhostSpec[]): GhostGroup[] {
  const groups = new Map<string | null, number[]>();
  ghosts.forEach((g, i) => {
    const list = groups.get(g.scriptSource);
    if (list) list.push(i);
    else groups.set(g.scriptSource, [i]);
  });
  return [...groups.values()].map((order) => {
    const source = ghosts[order[0]].scriptSource;
    const env = module.createEnv({ ...setup, scriptSource: source }, hostFor(source), mixSeed(GHOST_CONTROLLER_SALT));
    env.reset(
      order.map((i) => new Network(ghosts[i].genome)),
      order.map((i) => ghosts[i].seed),
      order.map((i) => ghosts[i].slot ?? 0),
    );
    return { env, order };
  });
}

/**
 * Plays a ghost scene to the end with nothing drawn and gives each ghost's
 * result in spec order. A lab uses it to check a scene before it shows it,
 * such as a Sandbox trip the trained model should arrive on.
 */
export function rehearseScene(module: AnyEpisodeModule, setup: EpisodeSetup, ghosts: readonly GhostSpec[]): unknown[] {
  const out: unknown[] = new Array(ghosts.length);
  for (const { env, order } of ghostGroups(module, setup, ghosts)) {
    while (!env.done) env.step();
    const results = env.results();
    order.forEach((ghost, k) => (out[ghost] = results[k]));
  }
  return out;
}
