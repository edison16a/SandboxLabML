import * as THREE from 'three';
import { lathe } from '../suv/geometry/lathe';
import { merge } from '../suv/geometry/grid';
import { bakeLook } from './looks';

/**
 * A traffic car wheel centered on its axle, outer face toward +Z: a tire
 * with rounded shoulders, a silver rim face and five dark slots between
 * spokes, so a rolling wheel visibly turns. Light enough to draw two
 * hundred at once.
 */
export function trafficWheelGeometry(radius: number, segments: number): THREE.BufferGeometry {
  const half = 0.105;
  const rim = radius * 0.66;
  const tire = lathe(
    [
      [
        [rim, -half],
        [radius - 0.03, -half - 0.004],
        [radius, -half + 0.03],
        [radius, half - 0.03],
        [radius - 0.03, half + 0.004],
        [rim, half],
      ],
    ],
    segments,
  );
  const face = new THREE.CircleGeometry(rim, segments).translate(0, 0, half - 0.012);
  const slots: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    slots.push(new THREE.PlaneGeometry(rim * 0.42, rim * 0.34).translate(0, rim * 0.56, half - 0.008).rotateZ(a));
  }
  const hub = new THREE.CircleGeometry(rim * 0.22, 10).translate(0, 0, half - 0.006);
  const parts = [bakeLook(tire, ['tire']), bakeLook(face, ['rim']), ...slots.map((g) => bakeLook(g, ['hub'])), bakeLook(hub, ['hub'])];
  const merged = merge(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}
