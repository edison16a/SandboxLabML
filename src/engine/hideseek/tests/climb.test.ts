import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localAhead, localLeft } from '../frame';
import { hideSeekPhysics, rampHeightAt } from '../physics';
import { AGENT_GROUPS, NO_GROUPS } from '../world/groups';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { CLIMB_RULES, placeBox, placeRamp, RAMP, record } from './climbHelpers';
import { idle, scripted, scriptedMatch, type ScriptedActions } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const P = CLIMB_RULES;
const L = P.box.ramp.length;
/** Meters up the slope per tick at full move output. */
const STEP = P.agent.maxSpeed * P.climb.speedShare * P.dt;

/** A ramp at the origin (locked unless asked), lip toward +x, and the seeker at (x, z) facing `yaw`, acting as `act` says. */
function setup(x: number, z: number, yaw: number, act: (t: number) => ScriptedActions, physics = P, locked = true) {
  const m = scriptedMatch(pool, 'open', idle(), scripted((_, t) => act(t)), physics);
  m.moveAgent('hider', -8, -8, 0);
  placeRamp(m, 0, 0, 0, locked);
  m.moveAgent('seeker', x, z, yaw);
  return m;
}

describe('mounting a ramp', () => {
  it('mounts from the foot zone when driving forward facing uphill', () => {
    const m = setup(-1.5, 0.3, 0.3, () => ({ move: 1 }));
    m.step();
    m.step();
    expect(m.seeker.climbing).toBe(true);
    expect(m.seeker.climbRamp).toBe(RAMP);
    expect(m.seeker.climbs).toBe(1);
    // It keeps its offset from the center line (+z is to the right facing uphill) and turns to face straight uphill.
    expect(m.state.controls[1].climb.lateral).toBeCloseTo(-0.3, 2);
    expect(m.seeker.yaw).toBe(0);
    expect(m.state.arena.agents[1].collider(0).collisionGroups()).toBe(NO_GROUPS);
    m.release();
  });

  it('does not mount facing more than 45 degrees off uphill, too slowly, or from beside the ramp', () => {
    // Facing 52 degrees off it stays put for the ticks it takes to decide. Driving on, it would slide along
    // the ramp's side and could turn uphill, and then it may well climb.
    const askew = setup(-1.5, 0, 0.9, () => ({ move: 1 }));
    expect(record(askew, 1, 3).some((f) => f.climbing)).toBe(false);
    askew.release();
    for (const [x, z, move] of [
      [-1.5, 0, 0.15],
      [-2.2, 0, 0.15],
      [-1.5, 0.9, 1],
    ]) {
      const m = setup(x, z, 0, () => ({ move }));
      expect(record(m, 1, 30).some((f) => f.climbing)).toBe(false);
      m.release();
    }
  });

  it('does not mount while holding a box', () => {
    // A wide grab cone lets the seeker pick up a cube beside it, which it then carries past the ramp's side.
    const wide = hideSeekPhysics({ prepShare: 0, grab: { cone: Math.PI * 1.5 } });
    const m = setup(-2.6, 0, 0, (t) => ({ move: t > 3 ? 1 : 0, grab: t < 100 }), wide);
    placeBox(m, 0, -2.6, 1.4);
    const holding = record(m, 1, 60);
    expect(holding.some((f) => f.climbing)).toBe(false);
    expect(m.seeker.holding).toBe(true);
    // Letting go, it mounts at once.
    const free = record(m, 1, 60);
    expect(m.seeker.holding).toBe(false);
    expect(free.some((f) => f.climbing)).toBe(true);
    m.release();
  });
});

describe('on the slope', () => {
  it('climbs at a share of top speed, its elevation following the slope', () => {
    const m = setup(-1.5, 0, 0, (t) => ({ move: t < 20 ? 1 : 0.5 }));
    const frames = record(m, 1, 25);
    const c = m.state.controls[1].climb;
    for (const f of frames.filter((g) => g.climbing)) expect(f.elevation).toBeCloseTo((P.box.ramp.height * (f.x + L / 2)) / L, 6);
    const before = c.progress;
    m.step();
    expect(c.progress - before).toBeCloseTo(STEP / 2, 9);
    expect(m.seeker.elevation).toBeCloseTo(rampHeightAt(P, c.progress), 9);
    expect(m.seeker.speed).toBeCloseTo(STEP / 2 / P.dt, 9);
    m.release();
  });

  it('rides a ramp that is pushed, staying where it stood on it', () => {
    // The seeker climbs halfway and stops; the hider then shoves the ramp sideways.
    const m = scriptedMatch(pool, 'open', scripted((_, t) => ({ move: t > 40 ? 1 : 0 })), scripted((_, t) => ({ move: t < 18 ? 1 : 0 })), P);
    placeRamp(m, 0, 0, 0);
    m.moveAgent('seeker', -1.5, 0, 0);
    m.moveAgent('hider', 0, -3, -Math.PI / 2);
    record(m, 1, 40);
    const c = m.state.controls[1].climb;
    const progress = c.progress;
    expect(m.seeker.climbing).toBe(true);
    record(m, 1, 50);
    const ramp = m.state.boxes[RAMP];
    expect(Math.hypot(ramp.x, ramp.z)).toBeGreaterThan(1);
    expect(m.seeker.climbing).toBe(true);
    expect(c.progress).toBe(progress);
    expect(localAhead(m.seeker.x - ramp.x, m.seeker.z - ramp.z, ramp.yaw)).toBeCloseTo(progress - L / 2, 4);
    expect(localLeft(m.seeker.x - ramp.x, m.seeker.z - ramp.z, ramp.yaw)).toBeCloseTo(c.lateral, 4);
    m.release();
  });

  it('backs off the foot onto the floor, with its collisions back', () => {
    const m = setup(-1.5, 0, 0, (t) => ({ move: t < 15 ? 1 : -1 }));
    const frames = record(m, 1, 80);
    const on = frames.findIndex((f) => f.climbing);
    const off = frames.findIndex((f, k) => k > on && !f.climbing);
    expect(on).toBeGreaterThan(-1);
    expect(off).toBeGreaterThan(on);
    expect(frames.some((f) => f.airborne)).toBe(false);
    expect(m.seeker.elevation).toBe(0);
    expect(m.state.arena.agents[1].collider(0).collisionGroups()).toBe(AGENT_GROUPS);
    expect(frames[off].x).toBeLessThan(-L / 2 - P.agent.radius);
    m.release();
  });

  it('stays at the foot of the slope when there is no room to step off', () => {
    const m = setup(-1.5, 0, 0, (t) => ({ move: t < 10 ? 1 : -1 }));
    record(m, 1, 3);
    expect(m.seeker.climbing).toBe(true);
    // A cube now stands right behind the foot.
    placeBox(m, 0, -L / 2 - 0.8, 0);
    m.setBoxLocked(0, true);
    record(m, 1, 60);
    expect(m.seeker.climbing).toBe(true);
    expect(m.state.controls[1].climb.progress).toBe(0);
    m.release();
  });

  it('cannot grab or lock, not even the free ramp under it', () => {
    // Up the slope the ramp's center is right in front of it, in grab and lock range.
    const m = setup(-1.5, 0, 0, (t) => ({ move: t < 18 ? 1 : 0, grab: true, lock: t % 6 < 3 }), P, false);
    const frames = record(m, 1, 40);
    expect(frames.some((f) => f.climbing)).toBe(true);
    expect(m.seeker.grabs).toBe(0);
    expect(m.seeker.locks).toBe(0);
    expect(m.state.boxes[RAMP].lockedBy).toBe(-1);
    m.release();
  });

  it('steps off the foot when its controller stops it on the slope', () => {
    const m = setup(-1.5, 0, 0, () => ({ move: 1 }));
    record(m, 1, 10);
    expect(m.seeker.climbing).toBe(true);
    // What the match does when a controller returns a stop.
    m.state.agents[1].stopReason = 'test';
    record(m, 1, 2);
    expect(m.seeker.climbing).toBe(false);
    expect(m.seeker.frozen).toBe(true);
    expect(m.seeker.x).toBeLessThan(-L / 2 - P.agent.radius);
    expect(m.state.arena.agents[1].collider(0).collisionGroups()).toBe(AGENT_GROUPS);
    m.release();
  });

  it('finishes a jump it is in when its controller stops it', () => {
    const m = setup(-1.5, 0, 0, () => ({ move: 1 }));
    while (!m.seeker.airborne && m.tick < 90) m.step();
    // Stop it two ticks into the jump.
    m.step();
    m.step();
    expect(m.seeker.airborne).toBe(true);
    m.state.agents[1].stopReason = 'test';
    record(m, 1, 20);
    expect(m.seeker.airborne).toBe(false);
    expect(m.seeker.elevation).toBe(0);
    expect(m.seeker.x).toBeCloseTo(m.state.controls[1].climb.toX, 4);
    m.release();
  });
});
