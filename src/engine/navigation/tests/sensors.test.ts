import { describe, expect, it } from 'vitest';
import { RAY_MOVER, RAY_NONE, RAY_SOLID, RAY_SPIKES } from '../agent';
import { sampleFlow } from '../course/fieldSample';
import { NAVIGATION_BLUEPRINTS } from '../pipeline/blueprints';
import { navRayAngles, STANDARD_NAVIGATION_INPUTS } from '../sensors/inputConfig';
import { navigationInputSchema } from '../sensors/inputSchema';
import { bearingOf, NavigationObserver } from '../sensors/observe';
import { castRay, rayRects, type RayWorld } from '../sensors/raycast';
import { builtinNavigationController } from '../builtinReward';
import { NavigationEnv } from '../env';
import { agentAt, params, room, worldAt } from './helpers';

describe('rays', () => {
  it('measure the distance to the nearest rectangle', () => {
    const rects = Float64Array.from([5, 0, 0.5, 1, 9, 0, 0.5, 1]);
    expect(rayRects(0, 0, 1, 0, 20, rects, 2)).toBeCloseTo(4.5, 9);
    expect(rayRects(0, 0, -1, 0, 20, rects, 2)).toBe(20);
    expect(rayRects(0, 3, 1, 0, 20, rects, 2)).toBe(20);
    expect(rayRects(5, 0, 1, 0, 20, rects, 2)).toBe(0);
  });

  it('tell solids, spikes and movers apart', () => {
    const course = room([
      { kind: 'block', x: 4, z: 0, hx: 0.5, hz: 0.5, height: 1 },
      { kind: 'spikes', x: 0, z: -3, hx: 1, hz: 0.5 },
      { kind: 'mover', hx: 0.5, hz: 0.5, height: 1, ax: -3, az: 0, bx: -3, bz: 0.01, period: 4, phase: 0 },
    ]);
    const w = worldAt(course);
    const world: RayWorld = { ...w, spikes: course.spikeData, spikeCount: course.spikes.length };
    const hit = { distance: 0, kind: 0 };
    expect(castRay(world, 0, 0, 1, 0, 10, hit)).toEqual({ distance: 3.5, kind: RAY_SOLID });
    expect(castRay(world, 0, 0, 0, -1, 10, hit).kind).toBe(RAY_SPIKES);
    expect(castRay(world, 0, 0, -1, 0, 10, hit).kind).toBe(RAY_MOVER);
    expect(castRay(world, 0, 0, 0, 1, 5, hit)).toEqual({ distance: 5, kind: RAY_NONE });
  });

  it('spread all round from straight ahead, or across a fan from left to right', () => {
    expect(navRayAngles(4, Math.PI * 2)).toEqual([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    expect(navRayAngles(3, Math.PI)).toEqual([Math.PI / 2, 0, -Math.PI / 2]);
  });
});

describe('observer', () => {
  it('writes ray, goal, hint and speed inputs in schema order', () => {
    const course = room([{ kind: 'block', x: 3, z: 0, hx: 0.5, hz: 1.5, height: 1 }]);
    const w = worldAt(course);
    const a = agentAt(course, 1.6, 0.2, 0);
    const obs = new NavigationObserver(STANDARD_NAVIGATION_INPUTS, params);
    obs.castRays(a, { ...w, spikes: course.spikeData, spikeCount: 0 });
    expect(a.rays[0]).toBeCloseTo(0.9, 9);
    expect(a.rayHits[0]).toBe(RAY_SOLID);
    a.vx = 2;
    a.distanceLeft = 10;
    const out = new Float64Array(64);
    const n = obs.write(a, course, out, null);
    expect(n).toBe(12 * 3 + 6);
    const base = 36;
    // Facing the finish: bearing 0. Close in front of the block, the hint steers round it.
    expect(out[base]).toBeCloseTo(0, 9);
    expect(out[base + 1]).toBeCloseTo(10 / 50, 9);
    expect(Math.abs(out[base + 2])).toBeGreaterThan(0.15);
    expect(out[base + 3]).toBeCloseTo(0.5, 9);
    expect(out[base + 4]).toBeCloseTo(0, 9);
  });

  it('counts time left on the env clock, not the course default', () => {
    const course = room([]);
    // Shorter than the stuck rule, so standing still ends the run on time.
    const maxTime = 3;
    expect(course.timeLimit).toBeGreaterThan(maxTime * 2);
    const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: builtinNavigationController, maxTime });
    env.reset([{ activate() {} }], [3], [0]);
    const a = env.agents[0];
    const k = env.inputSchema().findIndex((s) => s.key === 'timeLeft');
    // The front row stands half a meter behind the start line, so it gets that walk's time on top.
    expect(a.timeLimit).toBeGreaterThan(maxTime);
    expect(a.timeLimit).toBeLessThan(maxTime + 0.5);
    const ticks = Math.round(maxTime / 2 / params.dt);
    for (let t = 0; t < ticks; t++) env.step();
    expect(env.lastObservation(0)[k]).toBeCloseTo(1 - a.time / a.timeLimit, 9);
    expect(env.lastObservation(0)[k]).toBeLessThan(0.55);
    while (!env.done) env.step();
    expect(a.stopReason).toBe('time');
    expect(a.time).toBeGreaterThanOrEqual(a.timeLimit - 1e-6);
    expect(a.time).toBeLessThan(a.timeLimit + params.dt);
  });

  it('reads bearings with left positive', () => {
    // Heading +x; a point toward -z is to the left.
    expect(bearingOf(0, -1, 0)).toBeCloseTo(Math.PI / 2, 9);
    expect(bearingOf(0, 1, 0)).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('points the path hint round obstacles, toward the finish', () => {
    const course = room([{ kind: 'wall', x: 0, z: -1.5, hx: 0.15, hz: 5.5 }]);
    const f = { x: 0, z: 0 };
    // Right in front of the wall the way on is through the gap at +z.
    sampleFlow(course.field, -1.5, 0, f);
    expect(f.z).toBeGreaterThan(0.5);
    sampleFlow(course.field, -10, 5.5, f);
    expect(f.x).toBeGreaterThan(0.8);
  });
});

describe('input labels', () => {
  it('fit the network graph and never read the same twice, for every brain', () => {
    for (const b of NAVIGATION_BLUEPRINTS) {
      const labels = navigationInputSchema(b.inputs).map((s) => s.label);
      // The graph shows 17 characters before it cuts a label short.
      expect(labels.filter((l) => l.length > 17), b.id).toEqual([]);
      expect(new Set(labels).size, b.id).toBe(labels.length);
    }
  });
});
