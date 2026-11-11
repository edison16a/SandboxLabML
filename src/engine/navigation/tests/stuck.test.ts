import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { NAV_RUNNING } from '../agent';
import { buildCourse } from '../course/build';
import { generateCourse } from '../course/generate';
import { NAMED_COURSES } from '../course/presets';
import { NavigationEnv, type NavBrain } from '../env';
import { circleRect, deepestOverlap } from '../kinematics/collide';
import { slideMove, TOUCH_EPS, type CollisionWorld } from '../kinematics/slide';
import { STANDARD_NAVIGATION_INPUTS } from '../sensors/inputConfig';
import type { AgentController } from '../../env/types';
import type { NavAgent } from '../agent';
import { params, R } from './helpers';

/** Random controls that change every half second or so: long pushes into walls, spins and reversals. */
function randomController(seed: number): AgentController<NavAgent> {
  const rng = new Rng(seed);
  const held = new Map<number, [number, number, number]>();
  return {
    customSensorCount: 0,
    sensors() {},
    tick(a, io) {
      let h = held.get(a.index);
      if (!h || h[2] <= 0) {
        h = [rng.range(-1, 1.6), rng.chance(0.3) ? 0 : rng.range(-1, 1), rng.int(40) + 5];
        held.set(a.index, h);
      }
      h[2]--;
      io.action[0] = Math.min(1, h[0]);
      io.action[1] = h[1];
    },
  };
}

const idle: NavBrain = { activate() {} };
const push = { x: 0, z: 0 };

/** The solid nearest to p: its index, how far it is, and the unit direction straight away from it. */
function nearestSolid(p: { x: number; z: number }, w: CollisionWorld): { index: number; gap: number; ux: number; uz: number } {
  const best = { index: -1, gap: Infinity, ux: 0, uz: 0 };
  for (let i = 0; i < w.solidCount; i++) {
    const gap = distanceTo(p, w, i);
    if (gap >= best.gap) continue;
    const l = Math.hypot(push.x, push.z) || 1;
    Object.assign(best, { index: i, gap, ux: push.x / l, uz: push.z / l });
  }
  return best;
}

/** Distance from p to solid i, measured with a probe circle so the push direction comes out too. */
function distanceTo(p: { x: number; z: number }, w: CollisionWorld, i: number): number {
  const o = i * 4;
  const probe = 50;
  return probe - circleRect(p.x, p.z, probe, w.solids[o], w.solids[o + 1], w.solids[o + 2], w.solids[o + 3], push);
}

describe('agents never get stuck in walls', () => {
  const specs = [NAMED_COURSES.find((c) => c.id === 'gauntlet')!, NAMED_COURSES.find((c) => c.id === 'clockwork')!, generateCourse(6, 3), generateCourse(5, 11), generateCourse(4, 2)];
  for (const spec of specs) {
    it(`fuzzes random controls on ${spec.id} without ever overlapping a solid`, () => {
      const course = buildCourse(spec, params);
      // No time limit and no stuck rule: agents wander for a long while, pushing into everything.
      const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: randomController(7), maxTime: 1e9 });
      const n = 24;
      env.reset(Array.from({ length: n }, () => idle), Array.from({ length: n }, (_, i) => i + 1));
      const solids = course.solidData;
      for (let t = 0; t < 3000; t++) {
        env.step();
        for (const a of env.agents) {
          if (a.status !== NAV_RUNNING) continue;
          expect(deepestOverlap(a.x, a.z, R, solids, course.solids.length)).toBeLessThanOrEqual(TOUCH_EPS);
          expect(Math.abs(a.x)).toBeLessThan(course.halfLength);
          expect(Math.abs(a.z)).toBeLessThan(course.halfWidth);
        }
      }
    });
  }

  it('always walks away from the wall it touches', () => {
    const course = buildCourse(generateCourse(6, 3), params);
    const w: CollisionWorld = { solids: course.solidData, solidCount: course.solids.length, movers: new Float64Array(0), moverCount: 0 };
    const rng = new Rng(99);
    let checked = 0;
    for (let k = 0; k < 4000 && checked < 300; k++) {
      // Throw a point at the room, slide it hard toward a random direction until it rests against something.
      const p = { x: rng.range(-course.halfLength + 1, course.halfLength - 1), z: rng.range(-course.halfWidth + 1, course.halfWidth - 1) };
      if (deepestOverlap(p.x, p.z, R, w.solids, w.solidCount) > 0) continue;
      const a = rng.range(0, Math.PI * 2);
      for (let s = 0; s < 40; s++) slideMove(p, Math.cos(a) * 0.15, Math.sin(a) * 0.15, R, w);
      const near = nearestSolid(p, w);
      if (near.gap > R + 0.02) continue;
      // Resting against something: heading straight away from it must move it, and never closer. In a pocket it slides round the corner it meets.
      const x0 = p.x;
      const z0 = p.z;
      slideMove(p, near.ux * 0.1, near.uz * 0.1, R, w);
      expect(Math.hypot(p.x - x0, p.z - z0)).toBeGreaterThan(0.05);
      expect(distanceTo(p, w, near.index)).toBeGreaterThan(near.gap + 0.03);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
});
