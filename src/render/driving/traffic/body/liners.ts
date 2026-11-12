import type * as THREE from 'three';
import { gridGeometry, merge, polygonGeometry, type Vec3 } from '../../suv/geometry/grid';
import type { CarShape } from '../shape/types';
import { archRadius, axles, keysAt } from './frame';
import type { TrafficDetail } from './detail';
import { sideZ } from './shell';
import { ARCH_EDGE as EDGE, lowerStations } from './stations';

/**
 * The outline of a wheel opening in side view, front bottom up over the
 * wheel to rear bottom, through the very stations the body's opening is
 * cut at, so the liner's rim meets the paint's edge point for point and
 * no sliver of sky shows between them.
 */
function openingOutline(s: CarShape, axle: number, stations: readonly number[]): Array<[number, number]> {
  const r = archRadius(s);
  // The body's straight sides stand at the first stations outside the opening, a hair wider.
  const side = r + EDGE;
  const out: Array<[number, number]> = [[axle + side, keysAt(s, axle + side)[0].y]];
  const inside = stations.filter((x) => Math.abs(x - axle) <= r + 1e-9).sort((a, b) => b - a);
  for (const x of inside) out.push([x, s.wheelRadius + Math.sqrt(Math.max(0, r * r - (x - axle) ** 2))]);
  out.push([axle - side, keysAt(s, axle - side)[0].y]);
  return out;
}

/**
 * Dark liners inside the left wheel openings: a tunnel from the opening's
 * edge in toward the middle of the car and a wall closing it, so an
 * opening shows deep shadow round the tire instead of the far side of the
 * body. The tunnel faces the wheel; the wall faces out.
 */
export function wheelLiners(s: CarShape, d: TrafficDetail): THREE.BufferGeometry {
  const stations = lowerStations(s, d);
  const parts: THREE.BufferGeometry[] = [];
  const inner = s.track - 0.17;
  for (const axle of axles(s)) {
    const outline = openingOutline(s, axle, stations);
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
