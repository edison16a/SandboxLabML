import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIT_NONE } from '../agents/agent';
import type { HideSeekLayoutId } from '../layouts/types';
import type { HideSeekMatch } from '../match/match';
import { DEFAULT_HIDESEEK_PHYSICS, type HideSeekPhysics } from '../physics';
import type { HideSeekRewardId } from '../rewards';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { idle, NO_PREP, scriptedMatch } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** Facing -z is yaw PI/2, facing +z is yaw -PI/2 (see frame.ts). */
const FACE_NORTH = Math.PI / 2;
const FACE_SOUTH = -Math.PI / 2;

/**
 * Two idle agents placed by hand, boxes parked in the corners. The seeker
 * stands at (sx, sz) with yaw `seekerYaw`, the hider at (hx, hz) facing it.
 */
function standoff(
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

function seesAfterOneTick(m: HideSeekMatch): boolean {
  m.step();
  const sees = m.seeker.seesOpponent;
  expect(m.hider.seen).toBe(sees);
  expect(m.seeker.seen).toBe(sees);
  m.release();
  return sees;
}

describe('vision', () => {
  it('sees an opponent in the open, in range and in front', () => {
    expect(seesAfterOneTick(standoff('open', [0, 3, FACE_NORTH], [0, -3]))).toBe(true);
  });

  it('a wall between the agents blocks sight', () => {
    // Corridor has a long wall along z = 0 from x = -7 to x = 10.
    expect(seesAfterOneTick(standoff('corridor', [2, 2.5, FACE_NORTH], [2, -2.5]))).toBe(false);
  });

  it('a box between the agents blocks sight', () => {
    const m = standoff('open', [0, 3, FACE_NORTH], [0, -3]);
    m.moveBox(0, 0, 0);
    expect(seesAfterOneTick(m)).toBe(false);
  });

  it('facing away means not seen, and so does being out of range', () => {
    expect(seesAfterOneTick(standoff('open', [0, 3, FACE_SOUTH], [0, -3]))).toBe(false);
    expect(seesAfterOneTick(standoff('open', [0, 7.5, FACE_NORTH], [0, -7.5]))).toBe(false);
  });

  it('during prep the seeker sees nothing and its rays are blind', () => {
    const m = standoff('open', [0, 3, FACE_NORTH], [0, -3], DEFAULT_HIDESEEK_PHYSICS);
    const prep = m.state.prepTicks;
    for (let t = 0; t < prep; t++) {
      m.step();
      expect(m.seeker.prep).toBe(true);
      expect(m.seeker.seesOpponent).toBe(false);
      expect(m.hider.seen).toBe(false);
      expect(m.hider.hidden).toBe(false);
    }
    expect(m.hider.seesOpponent).toBe(true);
    expect(Array.from(m.seeker.rayHits).every((h) => h === HIT_NONE)).toBe(true);
    m.step();
    expect(m.seeker.prep).toBe(false);
    expect(m.seeker.seesOpponent).toBe(true);
    expect(m.hider.seen).toBe(true);
    expect(m.seeker.lastSeenAge).toBe(0);
    m.release();
  });
});

describe('built-in rewards', () => {
  const SEEK_SECONDS = DEFAULT_HIDESEEK_PHYSICS.matchSeconds * (1 - DEFAULT_HIDESEEK_PHYSICS.prepShare);

  function play(layout: HideSeekLayoutId, reward: HideSeekRewardId) {
    // In the corridor the wall at z = 0 hides the hider; in the open room it stands in plain sight.
    const m = standoff(layout, [2, 2.5, FACE_NORTH], [2, -2.5], DEFAULT_HIDESEEK_PHYSICS, reward);
    while (m.tick < m.state.prepTicks) m.step();
    const atPrepEnd = [m.hider.fitness, m.seeker.fitness];
    const result = m.run();
    m.release();
    return { atPrepEnd, result };
  }

  it('v1: the hider earns +1/s while hidden in the seek phase, the seeker -1/s', () => {
    const { atPrepEnd, result } = play('corridor', 'v1');
    expect(atPrepEnd).toEqual([0, 0]);
    expect(result.hiderReward).toBeCloseTo(SEEK_SECONDS, 9);
    expect(result.seekerReward).toBeCloseTo(-SEEK_SECONDS, 9);
    expect(result.hiddenShare).toBe(1);
    expect(result.firstSeenAt).toBe(-1);
  });

  it('v1: in plain sight the totals flip', () => {
    const { result } = play('open', 'v1');
    expect(result.hiderReward).toBeCloseTo(-SEEK_SECONDS, 9);
    expect(result.seekerReward).toBeCloseTo(SEEK_SECONDS, 9);
    expect(result.seenShare).toBe(1);
    expect(result.firstSeenAt).toBeCloseTo(DEFAULT_HIDESEEK_PHYSICS.dt, 9);
  });

  it('Starter pays only the good half', () => {
    const hidden = play('corridor', 'starter').result;
    expect(hidden.hiderReward).toBeCloseTo(SEEK_SECONDS, 9);
    expect(hidden.seekerReward).toBe(0);
    const seen = play('open', 'starter').result;
    expect(seen.hiderReward).toBe(0);
    expect(seen.seekerReward).toBeCloseTo(SEEK_SECONDS, 9);
  });
});
