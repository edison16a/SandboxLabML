import * as THREE from 'three';
import type { BoxSize } from '@/engine/hideseek/physics';
import { BOX_LOOK } from './boxMaterials';
import { FAR_BRACE, FlatMesh } from './flatMesh';
import { rampShape, type RampPanel } from './rampShape';

/**
 * The corners of a panel moved inward by `d` m from every edge, so frame
 * strips drawn along them stay on the panel and neighboring faces meet at
 * the edge. A sharp corner moves further, along the line that splits it.
 */
function insetRing(ring: THREE.Vector3[], d: number): THREE.Vector3[] {
  return ring.map((p, i) => {
    const e1 = ring[(i + ring.length - 1) % ring.length].clone().sub(p).normalize();
    const e2 = ring[(i + 1) % ring.length].clone().sub(p).normalize();
    const half = Math.acos(THREE.MathUtils.clamp(e1.dot(e2), -1, 1)) / 2;
    return p.clone().addScaledVector(e1.add(e2).normalize(), d / Math.sin(half));
  });
}

/**
 * A cheap ramp for the arena grid, one instanced draw call for every ramp:
 * flat jade panels with the frame, the side ridges and the grip treads as
 * flat strips just above them, about a hundred triangles. Like the grid
 * crate, the strips take the instance color, so a lock lights them.
 */
export function instancedRampGeometry(s: BoxSize): THREE.BufferGeometry {
  const mesh = new FlatMesh();
  const jade = new THREE.Color(BOX_LOOK.ramp);
  const shape = rampShape(s);
  const panel = (p: RampPanel, ridges: boolean) => {
    for (let i = 1; i + 1 < p.ring.length; i++) mesh.tri(p.ring[0], p.ring[i], p.ring[i + 1], jade);
    const inner = insetRing(p.ring, FAR_BRACE / 2);
    const middle = new THREE.Vector3();
    inner.forEach((q) => middle.add(q));
    middle.divideScalar(inner.length);
    inner.forEach((q, i) => {
      mesh.strip(q, inner[(i + 1) % inner.length], p.n);
      if (ridges) mesh.strip(q, middle, p.n);
    });
  };
  for (const p of [shape.slope, ...shape.plain]) panel(p, false);
  for (const p of shape.panels) panel(p, true);
  for (const t of shape.treads) mesh.strip(t.a, t.b, t.n);
  return mesh.build();
}
