import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HIDESEEK_PHYSICS, rampHeightAt } from '@/engine/hideseek/physics';
import { bracedRamp } from './bracedRamp';
import { instancedRampGeometry } from './instancedRamp';
import { rampShape } from './rampShape';

const P = DEFAULT_HIDESEEK_PHYSICS;
const R = P.box.ramp;

/** Every triangle of a mesh, as corner triples. */
function triangles(g: THREE.BufferGeometry): THREE.Vector3[][] {
  const pos = g.attributes.position;
  const out: THREE.Vector3[][] = [];
  const at = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i);
  const count = g.index ? g.index.count : pos.count;
  for (let i = 0; i < count; i += 3) out.push([0, 1, 2].map((k) => at(g.index ? g.index.getX(i + k) : i + k)));
  return out;
}

describe('the ramp mesh', () => {
  it('turns every panel outward, so no face of the wedge is culled from outside', () => {
    // The middle of the wedge's side triangle, inside the solid.
    const inside = new THREE.Vector3(R.length / 6, R.height / 3, 0);
    for (const [a, b, c] of triangles(bracedRamp(R).panels)) {
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      const out = a.clone().add(b).add(c).divideScalar(3).sub(inside);
      expect(normal.dot(out)).toBeGreaterThan(0);
    }
  });

  it('follows the engine wedge: the slope rises from the foot to the lip height', () => {
    const box = new THREE.Box3().setFromBufferAttribute(bracedRamp(R).panels.attributes.position as THREE.BufferAttribute);
    expect(box.min.x).toBeCloseTo(-R.length / 2, 5);
    expect(box.max.y).toBeCloseTo(R.height, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
    // Every tread lies on the slope at the height the engine climbs at.
    for (const t of rampShape(R).treads) {
      const progress = t.a.x + R.length / 2;
      expect(t.a.y).toBeCloseTo(rampHeightAt(P, progress), 5);
      expect(Math.abs(t.a.z)).toBeLessThan(R.width / 2);
    }
  });

  it('draws the grid ramp in one cheap mesh whose frame takes the lock tint', () => {
    const g = instancedRampGeometry(R);
    expect(g.attributes.position.count / 3).toBeLessThan(400);
    const tint = g.attributes.aTint.array as Float32Array;
    expect(tint.some((v) => v === 1)).toBe(true);
    expect(tint.some((v) => v === 0)).toBe(true);
  });
});
