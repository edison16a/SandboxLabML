import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDER } from '../agents/agent';
import { distanceToBox } from '../layouts/geometry';
import type { HideSeekMatch } from '../match/match';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { idle, NO_PREP, scripted, scriptedMatch, stageBox } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** Puts cube 0 at (x, z) and parks the other boxes by the walls, out of the way. */
const stage = (m: HideSeekMatch, x: number, z: number) => stageBox(m, 0, x, z);

describe('grab', () => {
  it('an agent driven at a cube with grab on picks it up and carries it', () => {
    // Drive straight at the cube, keep going with it, then curve left.
    const hider = scripted((_, t) => ({ move: 1, turn: t > 60 ? 0.5 : 0, grab: true }));
    const m = scriptedMatch(pool, 'open', hider, idle());
    m.moveAgent('hider', -7, 0, 0);
    m.moveAgent('seeker', 8, 0, 0);
    stage(m, -4, 0);
    let grabbedAt = -1;
    let maxGap = 0;
    let farthest = 0;
    for (let t = 0; t < 150; t++) {
      m.step();
      if (m.hider.justGrabbed && grabbedAt < 0) grabbedAt = m.tick;
      const box = m.state.boxes[0];
      if (grabbedAt > 0) maxGap = Math.max(maxGap, Math.hypot(box.x - m.hider.x, box.z - m.hider.z));
      farthest = Math.max(farthest, Math.hypot(box.x + 4, box.z));
    }
    expect(grabbedAt).toBeGreaterThan(0);
    expect(m.hider.holding).toBe(true);
    expect(m.hider.heldBox).toBe(0);
    expect(m.state.boxes[0].heldBy).toBe(HIDER);
    // It went along with the agent, far from its spot, and stayed at the hold point the whole time.
    expect(farthest).toBeGreaterThan(5);
    expect(maxGap).toBeLessThan(1.7);
    expect(m.result().hiderGrabs).toBe(1);
    m.release();
  });

  it('letting go of grab drops the box', () => {
    const hider = scripted((_, t) => ({ move: t < 40 ? 1 : 0, grab: t < 40 }));
    const m = scriptedMatch(pool, 'open', hider, idle());
    m.moveAgent('hider', -7, 0, 0);
    stage(m, -4, 0);
    for (let t = 0; t < 60; t++) m.step();
    expect(m.hider.holding).toBe(false);
    expect(m.state.boxes[0].heldBy).toBe(-1);
    m.release();
  });
});

describe('locked boxes', () => {
  /**
   * A seeker drives at cube 0 for three seconds. It may slide around an
   * angled face, so the check is that it never gets inside the box.
   */
  function seekerRun(locked: boolean, grab: boolean) {
    const m = scriptedMatch(pool, 'open', idle(), scripted(() => ({ move: 1, grab })), NO_PREP);
    m.moveAgent('hider', -8, -8, 0);
    m.moveAgent('seeker', -7, 0, 0);
    stage(m, -4, 0);
    if (locked) m.setBoxLocked(0, true);
    let held = false;
    let closest = Infinity;
    const [hx, hz] = [0.5, 0.5];
    for (let t = 0; t < 90; t++) {
      m.step();
      held ||= m.seeker.holding;
      const b = m.state.boxes[0];
      closest = Math.min(closest, distanceToBox(m.seeker.x, m.seeker.z, b.x, b.z, hx, hz, b.yaw));
    }
    const b = m.state.boxes[0];
    const out = { held, moved: Math.hypot(b.x + 4, b.z), closest };
    m.release();
    return out;
  }

  it('cannot be grabbed or pushed by a seeker', () => {
    const locked = seekerRun(true, true);
    expect(locked.held).toBe(false);
    expect(locked.moved).toBeLessThan(1e-6);
    // Its center never comes closer to the box than its own radius, give or take solver slop.
    expect(locked.closest).toBeGreaterThan(0.4 - 0.03);
    expect(seekerRun(true, false).moved).toBeLessThan(1e-6);
  });

  it('can be grabbed or pushed by a seeker when free', () => {
    expect(seekerRun(false, true).held).toBe(true);
    expect(seekerRun(false, false).moved).toBeGreaterThan(1);
  });
});

describe('lock', () => {
  /** Lock pulses: high for ticks 0 to 4, low for 5 to 9, high again from 10. */
  const pulses = scripted((_, t) => ({ lock: t < 5 || t >= 10 }));

  it('a hider locks a box in front with one press and unlocks it with the next', () => {
    const m = scriptedMatch(pool, 'open', pulses, idle());
    m.moveAgent('hider', -6, 0, 0);
    m.moveAgent('seeker', 8, 0, 0);
    stage(m, -4.6, 0);
    const lockedTicks: number[] = [];
    let unlockedAt = -1;
    for (let t = 0; t < 20; t++) {
      m.step();
      if (m.state.boxes[0].lockedBy === HIDER) lockedTicks.push(m.tick);
      if (m.hider.justLocked) expect(m.hider.boxesLockedByTeam).toBe(1);
      if (m.hider.justUnlocked) unlockedAt = m.tick;
    }
    expect(lockedTicks.length).toBeGreaterThan(5);
    expect(unlockedAt).toBeGreaterThan(lockedTicks[0]);
    expect(m.state.boxes[0].lockedBy).toBe(-1);
    expect(m.hider.boxesLockedByTeam).toBe(0);
    const r = m.result();
    expect(r.locksPlaced).toBe(1);
    expect(r.unlocks).toBe(1);
    expect(r.lockedAtEnd).toBe(0);
    m.release();
  });

});
