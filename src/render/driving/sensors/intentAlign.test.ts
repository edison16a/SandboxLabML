import { describe, expect, it } from 'vitest';
import { SUV } from '@/engine/driving/car/params';
import { Path } from '@/engine/driving/geometry/path';
import { alignToRoute } from './intentAlign';
import { predictPath, type Prediction } from './intentPath';

const COUNT = 7;
const FIRST = 7.35;
const SPACING = 3.8;

/** A straight lane along +x, its center on y = 0, 200 m long. */
const lane = new Path(
  Array.from({ length: 101 }, (_, i) => i * 2),
  Array.from({ length: 101 }, () => 0),
);

function fresh(): Prediction {
  return { count: 0, x: new Float64Array(COUNT), y: new Float64Array(COUNT), heading: new Float64Array(COUNT) };
}

/** The raw forecast of a car at (20, 0) heading down the lane with its wheel held left, `lock` of the way. */
function heldLeft(lock = 1, speed = 9): Prediction {
  const wheel = (lock * SUV.steerMax) / (1 + (speed / SUV.steerFadeSpeed) ** 2);
  return predictPath({ pos: { x: 20, z: 0 }, yaw: 0, speed, steer: wheel, pedal: 0.3 }, SUV, FIRST, SPACING, COUNT, fresh());
}

describe('intent chevrons on the route', () => {
  it('never draws a saturated steer forecast across the center line', () => {
    const raw = heldLeft();
    // Held for seconds, one tick's full lock curls the raw forecast far across the center line.
    expect(Math.max(...Array.from(raw.y.subarray(0, raw.count)))).toBeGreaterThan(4);
    const aligned = alignToRoute(heldLeft(), lane, { x: 20, y: 0, index: -1 }, 190, FIRST, SPACING, COUNT);
    expect(aligned.count).toBeGreaterThan(0);
    // Marks that would still lie across the line after the pull are dropped, not drawn there.
    for (let k = 0; k < aligned.count; k++) expect(Math.abs(aligned.y[k])).toBeLessThan(2.4);
  });

  it('bends a gentle correction back onto the lane ahead', () => {
    const raw = heldLeft(0.15);
    expect(raw.y[raw.count - 1]).toBeGreaterThan(1.5);
    const aligned = alignToRoute(heldLeft(0.15), lane, { x: 20, y: 0, index: -1 }, 190, FIRST, SPACING, COUNT);
    expect(aligned.count).toBe(raw.count);
    // The nearest mark still shows the car easing left; the furthest lies on the lane and points down it.
    const last = aligned.count - 1;
    expect(aligned.y[0]).toBeGreaterThan(0);
    expect(Math.abs(aligned.y[last])).toBeLessThan(0.05);
    expect(Math.abs(aligned.heading[last])).toBeLessThan(0.05);
  });

  it('leaves a straight forecast on the lane where it was', () => {
    const p = predictPath({ pos: { x: 20, z: 0 }, yaw: 0, speed: 9, steer: 0, pedal: 0.3 }, SUV, FIRST, SPACING, COUNT, fresh());
    const xs = Array.from(p.x.subarray(0, p.count));
    alignToRoute(p, lane, { x: 20, y: 0, index: -1 }, 190, FIRST, SPACING, COUNT);
    expect(p.count).toBe(xs.length);
    for (let k = 0; k < p.count; k++) {
      expect(p.x[k]).toBeCloseTo(xs[k], 6);
      expect(p.y[k]).toBeCloseTo(0, 6);
    }
  });

  it('draws nothing past the destination', () => {
    const p = predictPath({ pos: { x: 20, z: 0 }, yaw: 0, speed: 9, steer: 0, pedal: 0.3 }, SUV, FIRST, SPACING, COUNT, fresh());
    alignToRoute(p, lane, { x: 20, y: 0, index: -1 }, 20 + FIRST + SPACING * 2.5, FIRST, SPACING, COUNT);
    expect(p.count).toBe(3);
  });

  it('trusts the forecast alone for a car well off its route', () => {
    const p = heldLeft();
    const before = Array.from(p.y.subarray(0, p.count));
    alignToRoute(p, lane, { x: 20, y: 6, index: -1 }, 190, FIRST, SPACING, COUNT);
    expect(Array.from(p.y.subarray(0, p.count))).toEqual(before);
  });
});
