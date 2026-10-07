import { describe, expect, it } from 'vitest';
import { offsetX, offsetZ } from '@/engine/hideseek/frame';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { boxTransform, chevronPoints, rampChevrons } from './rampChevrons';

const RAMP = DEFAULT_HIDESEEK_PHYSICS.box.ramp;

/** Where an SVG `translate rotate` transform sends a point of the box frame. */
function applyTransform(t: string, [lx, ly]: readonly [number, number]): [number, number] {
  const [x, z, deg] = t.match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number);
  const a = (deg * Math.PI) / 180;
  return [x + lx * Math.cos(a) - ly * Math.sin(a), z + lx * Math.sin(a) + ly * Math.cos(a)];
}

describe('ramp chevrons', () => {
  it('point toward the lip, stay on the ramp and are mirror images across it', () => {
    for (const count of [1, 2, 3]) {
      const chevrons = rampChevrons(RAMP, count);
      expect(chevrons).toHaveLength(count);
      for (const [a, tip, b] of chevrons) {
        expect(tip[0]).toBeGreaterThan(a[0]);
        expect(a[0]).toBe(b[0]);
        expect(a[1]).toBe(-b[1]);
        for (const [x, y] of [a, tip, b]) {
          expect(Math.abs(x)).toBeLessThan(RAMP.length / 2);
          expect(Math.abs(y)).toBeLessThan(RAMP.width / 2);
        }
      }
      // Evenly spaced from the foot to the lip.
      const tips = chevrons.map((c) => c[1][0]);
      for (let k = 1; k < tips.length; k++) expect(tips[k] - tips[k - 1]).toBeCloseTo(RAMP.length / (count + 1));
    }
  });

  it('writes SVG points', () => {
    expect(
      chevronPoints([
        [0, -1],
        [1, 0],
        [0, 1],
      ]),
    ).toBe('0,-1 1,0 0,1');
  });

  it('turns the box frame the way the engine turns a yaw, so the chevrons point uphill on the map', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 0.4]) {
      const box = { x: 2, z: -3, yaw };
      const [x, z] = applyTransform(boxTransform(box), [1, 0]);
      expect(x).toBeCloseTo(box.x + offsetX(1, 0, yaw));
      expect(z).toBeCloseTo(box.z + offsetZ(1, 0, yaw));
    }
  });
});
