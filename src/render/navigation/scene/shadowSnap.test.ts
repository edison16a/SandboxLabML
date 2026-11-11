import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KEY, LIGHT_RIGHT, LIGHT_UP, snapShadowTarget } from './shadowSnap';

/** A point in the shadow map's own axes: right, up and depth along the light. */
function lightSpace(p: THREE.Vector3): [number, number, number] {
  return [p.dot(LIGHT_RIGHT), p.dot(LIGHT_UP), p.dot(KEY)];
}

describe('shadow box snapping', () => {
  it('uses axes square to each other and to the light', () => {
    expect(LIGHT_RIGHT.dot(LIGHT_UP)).toBeCloseTo(0, 9);
    expect(LIGHT_RIGHT.dot(KEY)).toBeCloseTo(0, 9);
    expect(LIGHT_UP.length()).toBeCloseTo(1, 9);
  });

  it('moves the map by whole texels only, keeping the depth, as the view glides', () => {
    const texel = 0.03;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let i = 0; i < 50; i++) {
      const x = -12 + i * 0.137;
      const z = 3 - i * 0.051;
      snapShadowTarget(x, z, texel, a);
      snapShadowTarget(x + 0.011, z - 0.007, texel, b);
      const [u, v, w] = lightSpace(a);
      const [u2, v2] = lightSpace(b);
      expect(Math.abs(u / texel - Math.round(u / texel))).toBeLessThan(1e-6);
      expect(Math.abs(v / texel - Math.round(v / texel))).toBeLessThan(1e-6);
      expect(Math.abs((u2 - u) / texel - Math.round((u2 - u) / texel))).toBeLessThan(1e-6);
      expect(Math.abs((v2 - v) / texel - Math.round((v2 - v) / texel))).toBeLessThan(1e-6);
      // Never further than half a texel each way from the point it was asked for.
      const [pu, pv, pw] = lightSpace(new THREE.Vector3(x, 0, z));
      expect(Math.abs(u - pu)).toBeLessThanOrEqual(texel / 2 + 1e-9);
      expect(Math.abs(v - pv)).toBeLessThanOrEqual(texel / 2 + 1e-9);
      expect(w).toBeCloseTo(pw, 9);
    }
  });
});
