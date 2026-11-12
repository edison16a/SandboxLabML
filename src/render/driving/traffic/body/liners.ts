import type * as THREE from 'three';
import { gridGeometry, merge, polygonGeometry, type Vec3 } from '../../suv/geometry/grid';
import type { CarShape } from '../shape/types';
import { archRadius, axles, keysAt } from './frame';
import { sideZ } from './shell';

/** The outline of a wheel opening in side view, front bottom up over the wheel to rear bottom. */
function openingOutline(s: CarShape, axle: number, steps: number): Array<[number, number]> {
  const r = archRadius(s);
  const front = keysAt(s, axle + r)[0].y;
  const rear = keysAt(s, axle - r)[0].y;
  const out: Array<[number, number]> = [[axle + r, front]];
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * i) / steps;
    out.push([axle + r * Math.cos(a), s.wheelRadius + r * Math.sin(a)]);
  }
  out.push([axle - r, rear]);
  return out;
}

/**
 * Dark liners inside the left wheel openings: a tunnel from the opening's
 * edge in toward the middle of the car and a wall closing it, so an
 * opening shows deep shadow round the tire instead of the far side of the
 * body. The tunnel faces the wheel; the wall faces out.
 */
export function wheelLiners(s: CarShape, steps: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const inner = s.track - 0.17;
  for (const axle of axles(s)) {
    const outline = openingOutline(s, axle, steps);
    const rows: Vec3[][] = outline.map(([x, y]) => [
      [x, y, sideZ(s, x, Math.max(y, keysAt(s, x)[0].y)) - 0.004],
      [x, y, inner],
    ]);
    parts.push(gridGeometry(rows));
    parts.push(polygonGeometry(outline.map(([x, y]) => [x, y, inner] as Vec3), [0, 0, 1]));
  }
  const g = merge(parts, []);
  parts.forEach((p) => p.dispose());
  return g;
}
