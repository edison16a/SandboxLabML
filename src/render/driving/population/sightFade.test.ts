import { describe, expect, it } from 'vitest';
import { blocksSight, PoseSet } from './sightFade';

describe('ghost sight fade', () => {
  // A chase camera 9 m behind and 3.3 m above an SUV at the origin heading +x.
  const cam = { x: -9, y: 3.3, z: 0 };

  it('fades a ghost between the chase camera and the followed SUV', () => {
    expect(blocksSight(cam.x, cam.y, cam.z, 0, 0, -4.5, 0)).toBe(true);
    expect(blocksSight(cam.x, cam.y, cam.z, 0, 0, -4.5, 1.2)).toBe(true);
  });

  it('keeps ghosts beside, past or behind the sight line', () => {
    expect(blocksSight(cam.x, cam.y, cam.z, 0, 0, -4.5, 3.6)).toBe(false);
    expect(blocksSight(cam.x, cam.y, cam.z, 0, 0, 8, 0)).toBe(false);
    expect(blocksSight(cam.x, cam.y, cam.z, 0, 0, -14, 0)).toBe(false);
  });

  it('leaves the stretch right by the followed SUV to its own fade', () => {
    expect(blocksSight(cam.x, cam.y, cam.z, 0, 0, -1, 0)).toBe(false);
  });
});

describe('PoseSet', () => {
  it('finds a ghost on the spot of one drawn before, turned the same way', () => {
    const s = new PoseSet(4);
    s.add(10, 5, 0.2);
    expect(s.has(10.4, 5.3, 0.3)).toBe(true);
    expect(s.has(10.4, 5.3, 0.2 + Math.PI)).toBe(false);
    expect(s.has(13, 5, 0.2)).toBe(false);
    s.clear();
    expect(s.has(10, 5, 0.2)).toBe(false);
  });
});
