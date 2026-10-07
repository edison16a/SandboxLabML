import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jumpElevation } from '../agents/climb/state';
import { distanceToBox } from '../layouts/geometry';
import { boxKindSize } from '../physics';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { CLIMB_RULES, placeBox, placeRamp, record } from './climbHelpers';
import { idle, scripted, scriptedMatch } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const P = CLIMB_RULES;
const LIP = P.box.ramp.length / 2;
const forward = () => scripted(() => ({ move: 1 }));

/** Box indexes of a cube and a plank in every 1 v 1 room (see BOX_KINDS). */
const CUBE = 0;
const PLANK = 2;

/**
 * A seeker runs up a locked ramp at the origin and jumps off its lip
 * toward +x, over box `index` locked at (x, 0) facing `yaw`. Checks the
 * agent stays at least box height whenever its center is over the box:
 * on every tick it plays, and along the whole planned arc.
 */
function expectClears(index: number, x: number, yaw: number): void {
  const m = scriptedMatch(pool, 'open', idle(), forward(), P);
  m.moveAgent('hider', -8, -8, 0);
  placeRamp(m, 0, 0, 0, true);
  placeBox(m, index, x, 0, yaw);
  m.setBoxLocked(index, true);
  m.moveAgent('seeker', -3, 0, 0);
  const box = m.state.boxes[index];
  const size = boxKindSize(P, box.kind);
  const over = (px: number, pz: number) => distanceToBox(px, pz, box.x, box.z, size.length / 2, size.width / 2, box.yaw) === 0;
  const frames = record(m, 1, 120);
  const above = frames.filter((f) => f.airborne && over(f.x, f.z));
  expect(above.length).toBeGreaterThan(0);
  for (const f of above) expect(f.elevation).toBeGreaterThanOrEqual(size.height);
  const c = m.state.controls[1].climb;
  for (let k = 0; k <= 1000; k++) {
    const t = k / 1000;
    if (over(c.fromX + (c.toX - c.fromX) * t, c.fromZ + (c.toZ - c.fromZ) * t)) expect(jumpElevation(c, t)).toBeGreaterThanOrEqual(size.height - 1e-9);
  }
  // It lands past the box, and hopping a box is no vault.
  expect(m.seeker.airborne || m.seeker.climbing).toBe(false);
  expect(m.seeker.x).toBeGreaterThan(x);
  expect(m.seeker.vaults).toBe(0);
  m.release();
}

describe('the arc of a jump', () => {
  it('stays above a crate 0.8 m past the lip all the way over it', () => {
    expectClears(CUBE, LIP + 0.8 + 0.5, 0);
  });

  it('stays above a plank lying lengthwise just past the lip', () => {
    expectClears(PLANK, LIP + 0.1 + 1.2, 0);
  });

  it('stays above a crate turned 45 degrees, whose far corner sits close to the landing', () => {
    expectClears(CUBE, LIP + 0.2 + Math.SQRT1_2, Math.PI / 4);
  });

  it('a jump past the end of a wall it runs along is no vault and keeps a low arc', () => {
    const m = scriptedMatch(pool, 'corridor', idle(), forward(), P);
    m.moveAgent('hider', -8, -8, 0);
    // The ramp lies along the z = 0 wall, which ends at x = -7.1, with its lip 0.6 m short of that end.
    placeRamp(m, -5.3, 0.75, Math.PI, true);
    // The seeker stands 0.41 m off the wall face, so every landing spot beside the wall is too close to it.
    m.moveAgent('seeker', -3, 0.51, Math.PI);
    const frames = record(m, 1, 120);
    expect(frames.some((f) => f.airborne)).toBe(true);
    expect(m.seeker.climbs).toBe(1);
    const c = m.state.controls[1].climb;
    expect(c.toX).toBeLessThan(-7.1);
    expect(c.toZ).toBeCloseTo(0.51, 2);
    expect(c.vault).toBe(false);
    expect(c.peak).toBeCloseTo(P.box.ramp.height + P.climb.clearance, 6);
    expect(frames.some((f) => f.justVaulted)).toBe(false);
    expect(m.seeker.vaults).toBe(0);
    expect(m.result().seekerVaults).toBe(0);
    m.release();
  });
});
