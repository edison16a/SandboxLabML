import { describe, expect, it } from 'vitest';
import { builtinNavigationController } from '../builtinReward';
import { buildCourse } from '../course/build';
import { formationSlots, formationSpot, seedSlot, startFormation } from '../course/formation';
import { generateCourse } from '../course/generate';
import { NAV_LEVELS } from '../course/levels';
import { NAMED_COURSES } from '../course/presets';
import { moverSweep } from '../course/movers';
import { NavigationEnv } from '../env';
import { STANDARD_NAVIGATION_INPUTS } from '../sensors/inputConfig';
import { params, R, room } from './helpers';

const idle = { activate() {} };

/** The start of an episode of `n` agents with slots handed out as a lab would. */
function lineUp(n: number, slots = formationSlots(n, 99)) {
  const course = room([], 30);
  const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: builtinNavigationController });
  env.reset(
    Array.from({ length: n }, () => idle),
    Array.from({ length: n }, (_, i) => 7000 + i),
    slots,
  );
  return { course, env };
}

function closestPair(points: ReadonlyArray<{ x: number; z: number }>): number {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) best = Math.min(best, Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z));
  return best;
}

describe('start formation', () => {
  it('fits 132 spots in rows behind the line of a 14 m room, none closer than a head', () => {
    const course = room([], 30);
    const f = course.formation;
    expect(f.columns).toBe(17);
    expect(f.capacity).toBeGreaterThanOrEqual(130);
    const spots = Array.from({ length: f.capacity }, (_, k) => {
      const p = { x: 0, z: 0 };
      formationSpot(f, k, p);
      return p;
    });
    expect(closestPair(spots)).toBeGreaterThan(0.76);
    for (const p of spots) {
      expect(p.x).toBeLessThan(course.startX - R);
      expect(p.x).toBeGreaterThan(-course.halfLength + R + 0.2);
      expect(Math.abs(p.z)).toBeLessThan(course.halfWidth - R - 0.1);
    }
  });

  it('fills from the front middle outward, whatever the agent count', () => {
    const f = startFormation(-8, 14, 30, params);
    const p = { x: 0, z: 0 };
    formationSpot(f, 0, p);
    expect(p).toEqual({ x: f.frontX, z: 0 });
    formationSpot(f, 1, p);
    expect(p.x).toBe(f.frontX);
    expect(p.z).toBeCloseTo(f.spacing, 9);
    formationSpot(f, 2, p);
    expect(p.z).toBeCloseTo(-f.spacing, 9);
    formationSpot(f, f.columns, p);
    expect(p.x).toBeCloseTo(f.frontX - f.rowGap, 9);
    expect(p.z).toBeCloseTo(-f.spacing / 2, 9);
  });

  it('lines 100 agents up in a tidy block without stacking any two', () => {
    const { course, env } = lineUp(100);
    const xs = env.agents.map((a) => a.x);
    expect(closestPair(env.agents)).toBeGreaterThan(0.6);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5);
    expect(Math.max(...xs)).toBeLessThan(course.startX);
    expect(new Set(env.agents.map((a) => a.slot)).size).toBe(100);
  });

  it('places past capacity in the gaps, still inside the room', () => {
    const { course, env } = lineUp(180);
    for (const a of env.agents) {
      expect(Math.abs(a.z)).toBeLessThan(course.halfWidth - R + 1e-9);
      expect(a.x).toBeGreaterThan(-course.halfLength + R - 1e-9);
    }
  });

  it('hands out every slot once, in a seeded order', () => {
    const a = formationSlots(100, 5);
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 100 }, (_, i) => i));
    expect(formationSlots(100, 5)).toEqual(a);
    expect(formationSlots(100, 6)).not.toEqual(a);
  });

  it('gives an agent with no slot a spot from its seed', () => {
    const course = room([], 30);
    expect(seedSlot(42, course.formation)).toBe(seedSlot(42, course.formation));
    const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: builtinNavigationController });
    env.reset([idle, idle], [42, 43]);
    expect(env.agents[0].slot).toBe(seedSlot(42, course.formation));
    expect(env.agents[0].x).toBeLessThan(course.startX);
  });

  it('starts everyone at no progress and gives the back rows time for their extra walk', () => {
    const { course, env } = lineUp(100, Array.from({ length: 100 }, (_, i) => i));
    const front = env.agents[0];
    const back = env.agents[99];
    env.step();
    expect(front.progress).toBe(0);
    expect(back.progress).toBe(0);
    expect(back.startDistance).toBeGreaterThan(front.startDistance + 2.5);
    expect(back.timeLimit - front.timeLimit).toBeCloseTo((back.startDistance - front.startDistance) / (params.agent.maxSpeed / 2), 6);
    expect(front.startDistance).toBeGreaterThan(course.startDistance);
    // On the grid the course yardstick runs below 0, so the view starts on the front row.
    expect(back.courseProgress).toBeLessThan(front.courseProgress);
    expect(front.courseProgress).toBeLessThan(0);
    expect(env.agents[env.leaderIndex()].x).toBeCloseTo(course.formation.frontX, 0);
  });

  it('keeps every course clear of the start zone', () => {
    const specs = [...NAMED_COURSES, ...NAV_LEVELS.flatMap((lv) => Array.from({ length: 20 }, (_, s) => generateCourse(lv.level, s + 1)))];
    for (const spec of specs) {
      const course = buildCourse(spec, params);
      for (const o of spec.obstacles) {
        const r = o.kind === 'mover' ? moverSweep(o) : o;
        expect(r.x - r.hx).toBeGreaterThan(course.startX + 0.9);
      }
    }
  });
});
