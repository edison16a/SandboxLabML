import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { addArches } from './arches';
import { DETAIL, PartBin, type Detail } from './parts';
import { ARCH, AXLES } from './profile';

/**
 * Share of a slot's left side triangles that face the wheel they wrap:
 * toward the wheel's center, with a little outward lean, since the lip
 * and the trim ring also face the street. A triangle facing the other way
 * is culled by a front side material and the arch shows a hole.
 */
function facingWheel(detail: Detail, slot: 'paint' | 'clad' | 'liner'): number {
  const bin = new PartBin();
  addArches(bin, detail);
  const g = bin.build().get(slot) as THREE.BufferGeometry;
  const p = g.attributes.position;
  const [a, b, c, e1, e2, n, to] = Array.from({ length: 7 }, () => new THREE.Vector3());
  let left = 0;
  let good = 0;
  for (let t = 0; t < p.count; t += 3) {
    a.fromBufferAttribute(p, t);
    b.fromBufferAttribute(p, t + 1);
    c.fromBufferAttribute(p, t + 2);
    const cz = (a.z + b.z + c.z) / 3;
    if (cz <= 0) continue;
    const cx = (a.x + b.x + c.x) / 3;
    const axle = AXLES.reduce((best, x) => (Math.abs(x - cx) < Math.abs(best - cx) ? x : best));
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    if (n.lengthSq() < 1e-14) continue;
    to.set(axle - cx, ARCH.centerY - (a.y + b.y + c.y) / 3, 0).normalize();
    to.z = 0.5;
    left++;
    if (n.dot(to) > 0) good++;
  }
  return left ? good / left : 0;
}

describe('SUV wheel arches', () => {
  for (const tier of ['high', 'low', 'crowd'] as const) {
    it(`faces the rolled edge, the trim and the liner toward the wheel (${tier})`, () => {
      if (DETAIL[tier].brakes) expect(facingWheel(DETAIL[tier], 'paint')).toBe(1);
      expect(facingWheel(DETAIL[tier], 'clad')).toBe(1);
      expect(facingWheel(DETAIL[tier], 'liner')).toBe(1);
    });
  }
});
