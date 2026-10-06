import { Network } from '../../neat/network';
import { getLayout } from '../layouts/presets';
import { DEFAULT_HIDESEEK_PHYSICS } from '../physics';
import { builtinHideSeekController } from '../rewards';
import type { ArenaPool } from '../world/pool';
import { HideSeekMatch } from './match';
import { scriptedTeamController } from './scriptedTeam';
import type { MatchControllers, MatchResult, MatchSpec } from './types';

/**
 * Sets up a match from its spec on a pooled world and returns it ready to
 * step. Call `release()` on it when done so the world goes back to the
 * pool. Used by watch mode and the arena grid, which step many matches
 * side by side.
 */
export function startMatch(spec: MatchSpec, pool: ArenaPool, controllers: MatchControllers = {}): HideSeekMatch {
  const physics = spec.physics ?? DEFAULT_HIDESEEK_PHYSICS;
  const arena = pool.acquire(getLayout(spec.layout), physics);
  const builtin = builtinHideSeekController(spec.reward ?? 'v1');
  const hider = spec.hider.scripted ? scriptedTeamController(spec.hider, true) : (controllers.hider ?? builtin);
  const seeker = spec.seeker.scripted ? scriptedTeamController(spec.seeker, false) : (controllers.seeker ?? builtin);
  try {
    return new HideSeekMatch(
      arena,
      {
        seed: spec.seed,
        hider: { brain: new Network(spec.hider.genome), inputs: spec.hider.inputs, controller: hider },
        seeker: { brain: new Network(spec.seeker.genome), inputs: spec.seeker.inputs, controller: seeker },
        prepSeconds: spec.prepSeconds,
      },
      () => pool.release(arena),
    );
  } catch (err) {
    pool.release(arena);
    throw err;
  }
}

/**
 * Plays a whole match headless and returns its result. A pure function of
 * the spec (and controllers): the pooled world is reset first, so whatever
 * ran on it before has no effect. This is what a worker runs.
 */
export function runMatch(spec: MatchSpec, pool: ArenaPool, controllers: MatchControllers = {}): MatchResult {
  const match = startMatch(spec, pool, controllers);
  try {
    return match.run();
  } finally {
    match.release();
  }
}
