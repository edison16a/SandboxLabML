import type { AgentController, TickIO } from '../../env/types';
import { Network } from '../../neat/network';
import { Population } from '../../neat/population';
import type { Genome } from '../../neat/types';
import type { HideSeekAgent } from '../agents/agent';
import { HIDESEEK_OUTPUT_COUNT, hideSeekInputCount, STANDARD_HIDESEEK_INPUTS, type HideSeekInputConfig } from '../inputConfig';
import { getLayout } from '../layouts/presets';
import type { HideSeekLayoutId } from '../layouts/types';
import { HideSeekMatch } from '../match/match';
import { startMatch } from '../match/runMatch';
import type { MatchSpec } from '../match/types';
import { DEFAULT_HIDESEEK_PHYSICS, hideSeekPhysics, type HideSeekPhysics } from '../physics';
import { HIDESEEK_REWARDS, type HideSeekRewardId } from '../rewards';
import { HIDESEEK_SNAPSHOT } from '../snapshot';
import type { ArenaPool } from '../world/pool';

/** Rules with no prep phase, so seekers can act from the first tick in scripted scenarios. */
export const NO_PREP = hideSeekPhysics({ prepShare: 0 });

/** Seeded random genomes shaped for an input config. */
export function randomGenomes(inputs: HideSeekInputConfig, count: number, seed: number): Genome[] {
  const shape = { inputCount: hideSeekInputCount(inputs), outputCount: HIDESEEK_OUTPUT_COUNT, activation: 'tanh' as const, wiring: 'direct' as const };
  return Population.create(shape, seed, { populationSize: count }).genomes;
}

/** Actions a scripted agent picks each tick, from its view and the tick number. */
export interface ScriptedActions {
  move?: number;
  turn?: number;
  grab?: boolean;
  lock?: boolean;
}

/**
 * A controller that ignores the brain and acts from a plain function, while
 * scoring with the chosen built-in rewards. Lets a test drive an agent
 * exactly.
 */
export function scripted(act: (a: HideSeekAgent, tick: number) => ScriptedActions, reward: HideSeekRewardId = 'v1'): AgentController<HideSeekAgent> {
  const base = HIDESEEK_REWARDS[reward];
  return {
    customSensorCount: 0,
    sensors() {},
    tick(a: HideSeekAgent, io: TickIO) {
      base.tick(a, io);
      const out = act(a, Math.round(a.time / a.dt));
      io.action[0] = out.move ?? 0;
      io.action[1] = out.turn ?? 0;
      io.action[2] = out.grab ? 1 : -1;
      io.action[3] = out.lock ? 1 : -1;
    },
  };
}

export const idle = (reward: HideSeekRewardId = 'v1') => scripted(() => ({}), reward);

/** A match on a pooled world where both agents follow scripts. */
export function scriptedMatch(
  pool: ArenaPool,
  layout: HideSeekLayoutId,
  hider: AgentController<HideSeekAgent>,
  seeker: AgentController<HideSeekAgent>,
  physics: HideSeekPhysics = DEFAULT_HIDESEEK_PHYSICS,
  seed = 1,
): HideSeekMatch {
  const inputs = STANDARD_HIDESEEK_INPUTS;
  const brain = new Network(randomGenomes(inputs, 1, 99)[0]);
  const arena = pool.acquire(getLayout(layout), physics);
  return new HideSeekMatch(arena, { seed, hider: { brain, inputs, controller: hider }, seeker: { brain, inputs, controller: seeker } }, () =>
    pool.release(arena),
  );
}

/** Facing -z is yaw PI/2, facing +z is yaw -PI/2 (see frame.ts). */
export const FACE_NORTH = Math.PI / 2;
export const FACE_SOUTH = -Math.PI / 2;

/**
 * Two idle agents placed by hand, boxes parked in the corners. The seeker
 * stands at (sx, sz) with yaw `seekerYaw`, the hider at (hx, hz) facing
 * south. Both score with `reward`.
 */
export function placedMatch(
  pool: ArenaPool,
  layout: HideSeekLayoutId,
  [sx, sz, seekerYaw]: [number, number, number],
  [hx, hz]: [number, number],
  physics: HideSeekPhysics = NO_PREP,
  reward: HideSeekRewardId = 'v1',
): HideSeekMatch {
  const m = scriptedMatch(pool, layout, idle(reward), idle(reward), physics);
  m.moveAgent('seeker', sx, sz, seekerYaw);
  m.moveAgent('hider', hx, hz, FACE_SOUTH);
  m.moveBox(0, -8.5, 8.5);
  m.moveBox(1, 8.5, 8.5);
  m.moveBox(2, -7.5, -8.5);
  m.moveBox(3, 7.5, -8.5);
  return m;
}

/** Plays a spec to the end, keeping every tick's snapshot. */
export function traceMatch(spec: MatchSpec, pool: ArenaPool): { snapshots: Float32Array; result: ReturnType<HideSeekMatch['result']> } {
  const match = startMatch(spec, pool);
  const stride = HIDESEEK_SNAPSHOT.stride;
  const snapshots = new Float32Array(match.state.totalTicks * stride);
  while (!match.done) {
    match.step();
    match.snapshot(snapshots, (match.tick - 1) * stride);
  }
  const result = match.result();
  match.release();
  return { snapshots, result };
}
