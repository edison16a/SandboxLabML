import { describe, expect, it } from 'vitest';
import { RAY_MOVER, RAY_NONE, RAY_SOLID, RAY_SPIKES } from '../agent';
import { sampleFlow } from '../course/fieldSample';
import { navRayAngles, STANDARD_NAVIGATION_INPUTS } from '../sensors/inputConfig';
import { bearingOf, NavigationObserver } from '../sensors/observe';
import { castRay, rayRects, type RayWorld } from '../sensors/raycast';
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
