import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { HIT_BOX, HIT_WALL } from '../agents/agent';
import { boxSlice, type BoxSlice } from '../physics';
import { rayAabb, rayBox } from '../sensing/raycast2d';
import { SightLines } from '../sensing/vision';
import { createArenaPool, type ArenaPool } from '../world/pool';
import type { HideSeekMatch } from '../match/match';
import { CLIMB_RULES, placeBox, placeRamp, RAMP, record } from './climbHelpers';
import { idle, scripted, scriptedMatch } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const P = CLIMB_RULES;
const L = P.box.ramp.length;

/** The seeker climbs a locked ramp at the origin (lip toward +x) for `ticks` ticks, then stands still on it. */
function climber(ticks: number): HideSeekMatch {
  const m = scriptedMatch(pool, 'open', idle(), scripted((_, t) => ({ move: t < ticks ? 1 : 0 })), P);
  placeRamp(m, 0, 0, 0, true);
  m.moveAgent('seeker', -1.5, 0, 0);
  return m;
}

describe('sight with ramps', () => {
  it('sees over boxes from high on a ramp, and is seen over them', () => {
    // A cube stands between the ramp's lip and the hider, which faces the ramp.
    const low = climber(14);
    placeBox(low, 0, 3.5, 0);
    low.moveAgent('hider', 6, 0, Math.PI);
    record(low, 1, 30);
    expect(low.seeker.climbing).toBe(true);
    expect(low.seeker.elevation).toBeLessThan(P.climb.seeOverBoxes);
    expect(low.seeker.seesOpponent).toBe(false);
    expect(low.hider.seesOpponent).toBe(false);
    low.release();
    const high = climber(31);
    placeBox(high, 0, 3.5, 0);
    high.moveAgent('hider', 6, 0, Math.PI);
    record(high, 1, 40);
    expect(high.seeker.climbing).toBe(true);
    expect(high.seeker.elevation).toBeGreaterThanOrEqual(P.climb.seeOverBoxes);
    expect(high.seeker.seesOpponent).toBe(true);
    expect(high.hider.seesOpponent).toBe(true);
    high.release();
  });

  it('never sees over a wall, not even at the top of a vault', () => {
    const m = scriptedMatch(pool, 'shelter', idle(), scripted(() => ({ move: 1 })), P);
    placeRamp(m, -2.9 + L / 2 + 0.05, -6.5, Math.PI, true);
    m.moveAgent('seeker', 1.5, -6.5, Math.PI);
    // The hider waits inside the half room, in line with the jump but off its landing spot.
    m.moveAgent('hider', -8.5, -5.5, 0);
    let highest = 0;
    let landed = false;
    for (let t = 0; t < 120 && !landed; t++) {
      m.step();
      // Until its center is past the far face of the wall, the wall is in the way.
      if (m.seeker.x > -3.1) {
        expect(m.seeker.seesOpponent).toBe(false);
        highest = Math.max(highest, m.seeker.elevation);
      }
      landed = m.seeker.justVaulted;
    }
    expect(highest).toBeGreaterThan(P.arena.wallHeight);
    expect(landed).toBe(true);
    m.step();
    expect(m.seeker.seesOpponent).toBe(true);
    m.release();
  });

  it("a climber's rays pass through its own ramp, and over every box once it is high enough", () => {
    // Part way up, the seeker stands inside the ramp's slice: a floor agent there would see 0 m every way.
    const m = climber(22);
    // A plank turned across the line ahead, its near face at x = 3.8.
    placeBox(m, 2, 4, 0, Math.PI / 2);
    record(m, 1, 30);
    const a = m.seeker;
    expect(a.climbing).toBe(true);
    expect(m.state.controls[1].climb.progress).toBeGreaterThan(L * (P.rayHeight / P.box.ramp.height));
    expect(a.elevation).toBeLessThan(P.climb.seeOverBoxes);
    expect(a.rays[0]).toBeCloseTo(3.8 - a.x, 4);
    expect(a.rayHits[0]).toBe(HIT_BOX);
    m.release();
    // Near the lip it looks over the plank to the far wall.
    const high = climber(32);
    placeBox(high, 2, 4, 0, Math.PI / 2);
    record(high, 1, 40);
    expect(high.seeker.elevation).toBeGreaterThanOrEqual(P.climb.seeOverBoxes);
    expect(high.seeker.rays[0]).toBeCloseTo(10 - high.seeker.x, 4);
    expect(high.seeker.rayHits[0]).toBe(HIT_WALL);
    high.release();
  });

  it('agrees with the 2D slices: Rapier sight lines against ramps at any pose', async () => {
    const rng = new Rng(5);
    const slice = boxSlice(P, 'ramp');
    let compared = 0;
    let blocked = 0;
    for (let k = 0; k < 8; k++) {
      const m = scriptedMatch(pool, 'open', idle(), idle(), P);
      const yaw = rng.range(-Math.PI, Math.PI);
      placeRamp(m, rng.range(-2, 2), rng.range(-2, 2), yaw, true);
      m.step();
      const sight = new SightLines(m.state.arena);
      const ramp = m.state.boxes[RAMP];
      for (let n = 0; n < 60; n++) {
        const a = [rng.range(-6, 6), rng.range(-6, 6)];
        const b = [rng.range(-6, 6), rng.range(-6, 6)];
        const flat = clear2d(m, slice, ramp.x, ramp.z, ramp.yaw, a[0], a[1], b[0], b[1]);
        expect(sight.clear(a[0], a[1], b[0], b[1])).toBe(flat);
        compared++;
        if (!flat) blocked++;
      }
      m.release();
    }
    expect(compared).toBe(480);
    expect(blocked).toBeGreaterThan(40);
  });
});

/** The same line of sight in 2D: walls and the ramp's slice, with every other box parked far away by the walls. */
function clear2d(m: HideSeekMatch, s: BoxSlice, rx: number, rz: number, yaw: number, x0: number, z0: number, x1: number, z1: number): boolean {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const dx = (x1 - x0) / len;
  const dz = (z1 - z0) / len;
  const c = Math.cos(yaw);
  const n = Math.sin(yaw);
  let best = rayBox(x0, z0, dx, dz, rx + s.offset * c, rz - s.offset * n, s.hx, s.hz, c, n);
  for (const w of m.state.arena.walls) best = Math.min(best, rayAabb(x0, z0, dx, dz, w.x, w.z, w.hx, w.hz));
  for (let b = 0; b < RAMP; b++) {
    const box = m.state.boxes[b];
    const bs = boxSlice(P, box.kind);
    best = Math.min(best, rayBox(x0, z0, dx, dz, box.x, box.z, bs.hx, bs.hz, Math.cos(box.yaw), Math.sin(box.yaw)));
  }
  return best >= len;
}
