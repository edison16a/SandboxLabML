import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { distanceToBox } from '../layouts/geometry';
import { hideSeekPhysics } from '../physics';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { FACE_NORTH, FACE_SOUTH, idle, scripted, scriptedMatch, stageBox } from './helpers';

/** No prep, and a mount threshold no output reaches, so agents only ever push ramps here. */
const NO_CLIMB = hideSeekPhysics({ prepShare: 0, climb: { mountMove: 2 } });
const RAMP = 4;
const PLANK = 2;

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/**
 * The seeker drives at full speed for three seconds from (x, z) facing
 * `yaw`, at box `index` placed at the origin facing +x. Returns how far
 * the box went and how it ended up, plus the seeker's last second.
 */
function push(index: number, x: number, z: number, yaw: number, locked = false) {
  const m = scriptedMatch(pool, 'open', idle(), scripted(() => ({ move: 1 })), NO_CLIMB);
  m.moveAgent('hider', -8, -8, 0);
  m.moveAgent('seeker', x, z, yaw);
  stageBox(m, index, 0, 0);
  const b = m.state.boxes[index];
  b.yaw = 0;
  m.state.arena.teleport(m.state.arena.boxes[index], b);
  if (locked) m.setBoxLocked(index, true);
  const late: Array<[number, number]> = [];
  let deepest = Infinity;
  let maxY = 0;
  let minY = Infinity;
  const size = index === RAMP ? NO_CLIMB.box.ramp : NO_CLIMB.box.plank;
  for (let t = 0; t < 90; t++) {
    m.step();
    if (t >= 60) late.push([m.seeker.x, m.seeker.z]);
    deepest = Math.min(deepest, distanceToBox(m.seeker.x, m.seeker.z, b.x, b.z, size.length / 2, size.width / 2, b.yaw));
    const y = m.state.arena.boxes[index].translation().y;
    maxY = Math.max(maxY, y);
    minY = Math.min(minY, y);
  }
  const spread = Math.max(...late.map(([px, pz]) => Math.hypot(px - late[0][0], pz - late[0][1])));
  const out = { dx: b.x, dz: b.z, yaw: b.yaw, seeker: { x: m.seeker.x, z: m.seeker.z }, spread, deepest, ySpan: maxY - minY };
  m.release();
  return out;
}

describe('ramp body', () => {
  it('stops an agent walking into its slope, steadily and just short of the foot', () => {
    const r = push(RAMP, -4, 0, 0, true);
    // The round bottom of the capsule meets the thin end of the wedge about 0.1 m out.
    expect(r.seeker.x).toBeGreaterThan(-1.2 - 0.25);
    expect(r.seeker.x).toBeLessThan(-1.2);
    expect(Math.abs(r.seeker.z)).toBeLessThan(0.05);
    // Pressed against the slope for a whole second it does not creep or shake.
    expect(r.spread).toBeLessThan(0.01);
    expect(r.dx).toBe(0);
  });

  it('moves like a crate when pushed from the foot, the lip or a side', () => {
    const fromFoot = push(RAMP, -4, 0, 0);
    const fromLip = push(RAMP, 4, 0, Math.PI);
    const fromSide = push(RAMP, 0, -3, FACE_SOUTH);
    const fromOtherSide = push(RAMP, 0, 3, FACE_NORTH);
    expect(fromFoot.dx).toBeGreaterThan(1);
    expect(fromLip.dx).toBeLessThan(-1);
    expect(fromSide.dz).toBeGreaterThan(1);
    expect(fromOtherSide.dz).toBeLessThan(-1);
    // A plank, the crate with the same length, pushed from its end and its side for comparison.
    const plankEnd = push(PLANK, -4, 0, 0);
    const plankSide = push(PLANK, 0, -3, FACE_SOUTH);
    expect(fromFoot.dx / plankEnd.dx).toBeGreaterThan(0.5);
    expect(fromFoot.dx / plankEnd.dx).toBeLessThan(2);
    expect(fromSide.dz / plankSide.dz).toBeGreaterThan(0.5);
    expect(fromSide.dz / plankSide.dz).toBeLessThan(2);
    // It slides on the floor plane and never lifts or sinks.
    for (const r of [fromFoot, fromLip, fromSide, fromOtherSide]) expect(r.ySpan).toBeLessThan(1e-6);
  });

  it('never lets a pushing agent into its footprint', () => {
    for (const r of [push(RAMP, -4, 0, 0), push(RAMP, 4, 0, Math.PI), push(RAMP, 0, -3, FACE_SOUTH)]) expect(r.deepest).toBeGreaterThan(0.4 - 0.35);
  });
});
