import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEEKER } from '../agents/agent';
import type { HideSeekMatch } from '../match/match';
import { DEFAULT_HIDESEEK_PHYSICS } from '../physics';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { FACE_SOUTH, idle, NO_PREP, scripted, scriptedMatch, stageBox } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** Puts cube 0 at (x, z) and parks the other boxes by the walls. */
const stage = (m: HideSeekMatch, x: number, z: number) => stageBox(m, 0, x, z);

describe('locks for both teams', () => {
  it('a seeker locks a box, owns the lock, and the hider can neither unlock, grab nor push it', () => {
    // The seeker presses lock from the first tick and again at tick 120, and
    // a press acts on the next step. The hider presses lock twice, then
    // drives into the box with grab on.
    const seeker = scripted((_, t) => ({ lock: t < 5 || (t >= 120 && t < 125) }));
    const hider = scripted((_, t) => ({ lock: (t >= 10 && t < 15) || (t >= 20 && t < 25), move: t >= 30 && t < 110 ? 1 : 0, grab: t >= 30 && t < 110 }));
    const m = scriptedMatch(pool, 'open', hider, seeker, NO_PREP);
    m.moveAgent('seeker', -6, 0, 0);
    m.moveAgent('hider', -4.6, -1.5, FACE_SOUTH);
    stage(m, -4.6, 0);
    let hiderToggled = false;
    let held = false;
    let moved = 0;
    for (let t = 0; t < 115; t++) {
      m.step();
      if (m.tick === 2) {
        expect(m.seeker.justLocked).toBe(true);
        expect(m.state.boxes[0].lockedBy).toBe(SEEKER);
        expect(m.seeker.boxesLockedByTeam).toBe(1);
        expect(m.hider.boxesLockedByOpponent).toBe(1);
        expect(m.hider.boxesLockedByTeam).toBe(0);
      }
      hiderToggled ||= m.hider.justLocked || m.hider.justUnlocked;
      held ||= m.hider.holding;
      const b = m.state.boxes[0];
      moved = Math.max(moved, Math.hypot(b.x + 4.6, b.z));
    }
    expect(hiderToggled).toBe(false);
    expect(held).toBe(false);
    expect(moved).toBeLessThan(1e-6);
    expect(m.state.boxes[0].lockedBy).toBe(SEEKER);
    // The seeker's next press frees it.
    m.moveAgent('seeker', -6, 0, 0);
    for (let t = 0; t < 20; t++) m.step();
    expect(m.state.boxes[0].lockedBy).toBe(-1);
    const r = m.result();
    expect(r.seekerLocks).toBe(1);
    expect(r.hiderLocks).toBe(0);
    expect(r.locksPlaced).toBe(1);
    expect(r.unlocks).toBe(1);
    m.release();
  });

  it('seekers are frozen during prep, so they lock only once the seek phase starts', () => {
    const seeker = scripted((_, t) => ({ lock: t % 20 < 5 }));
    const m = scriptedMatch(pool, 'open', idle(), seeker, DEFAULT_HIDESEEK_PHYSICS);
    m.moveAgent('seeker', -6, 0, 0);
    m.moveAgent('hider', 6, 6, 0);
    stage(m, -4.6, 0);
    let lockedAt = -1;
    while (lockedAt < 0 && m.tick < m.state.prepTicks + 40) {
      m.step();
      if (m.seeker.justLocked) lockedAt = m.tick;
    }
    expect(lockedAt).toBeGreaterThan(m.state.prepTicks);
    expect(m.state.boxes[0].lockedBy).toBe(SEEKER);
    m.release();
  });
});
