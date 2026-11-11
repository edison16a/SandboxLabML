import { describe, expect, it } from 'vitest';
import { circleRect, deepestOverlap } from '../kinematics/collide';
import { driveAgent } from '../kinematics/body';
import { slideMove, TOUCH_EPS } from '../kinematics/slide';
import { agentAt, params, R, room, worldAt } from './helpers';

describe('circle against rectangle', () => {
  it('measures depth and pushes out the shortest way', () => {
    const out = { x: 0, z: 0 };
    expect(circleRect(0, 0, 0.4, 1, 0, 0.5, 0.5, out)).toBe(0);
    const d = circleRect(0.3, 0, 0.4, 1, 0, 0.5, 0.5, out);
    expect(d).toBeCloseTo(0.2, 9);
    expect(out.x).toBeCloseTo(-0.2, 9);
    expect(out.z).toBe(0);
    // A center inside leaves through the nearest side.
    circleRect(1.4, 0.1, 0.4, 1, 0, 0.5, 0.5, out);
    expect(out.x).toBeCloseTo(0.5, 9);
  });
});

describe('sliding motion', () => {
  const course = room([{ kind: 'wall', x: 2, z: 0, hx: 0.15, hz: 4 }]);
  const world = worldAt(course);

  it('slides along a wall it runs into at an angle', () => {
    const a = agentAt(course, 0, 0, -0.6);
    for (let t = 0; t < 90; t++) driveAgent(a, 1, 0, params, world);
    // Stopped by the wall in x, but it kept going along it.
    expect(a.x).toBeLessThanOrEqual(2 - 0.15 - R + 1e-6);
    expect(a.z).toBeGreaterThan(2);
    expect(deepestOverlap(a.x, a.z, R, world.solids, world.solidCount)).toBeLessThanOrEqual(TOUCH_EPS);
  });

  it('never passes through a thin wall at full speed', () => {
    const p = { x: 0, z: 0 };
    for (let t = 0; t < 60; t++) slideMove(p, 4 / 30, 0, R, world);
    expect(p.x).toBeCloseTo(2 - 0.15 - R, 6);
    // Even a single huge step is cut into sub steps.
    const q = { x: 0, z: 1 };
    slideMove(q, 10, 0, R, world);
    expect(q.x).toBeLessThan(2);
  });

  it('settles into a concave corner and walks straight back out', () => {
    const box = room([
      { kind: 'wall', x: 3, z: 0, hx: 0.15, hz: 3 },
      { kind: 'wall', x: 1.5, z: 3, hx: 1.5, hz: 0.15 },
    ]);
    const w = worldAt(box);
    const a = agentAt(box, 1, 1, Math.atan2(-1, 1) - 0.2);
    for (let t = 0; t < 120; t++) driveAgent(a, 1, 0, params, w);
    expect(deepestOverlap(a.x, a.z, R, w.solids, w.solidCount)).toBeLessThanOrEqual(TOUCH_EPS);
    const x0 = a.x;
    const z0 = a.z;
    a.yaw += Math.PI;
    for (let t = 0; t < 15; t++) driveAgent(a, 1, 0, params, w);
    expect(Math.hypot(a.x - x0, a.z - z0)).toBeGreaterThan(0.8);
  });
});
