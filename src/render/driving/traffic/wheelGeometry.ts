import type * as THREE from 'three';
import { gridGeometry, merge, type Vec3 } from '../suv/geometry/grid';
import { lathe } from '../suv/geometry/lathe';
import { bakeLook } from './looks';

/** Tire width, m. */
const WIDTH = 0.225;

/** Depth of the rim's dish below the outer face at radius r, m: shallow at the lip, deepest at the hub. */
const dish = (r: number, rim: number) => 0.008 + 0.024 * (1 - r / rim);

/**
 * A traffic car wheel centered on its axle, outer face toward +Z: a black
 * tread with rounded shoulders, a lighter satin sidewall, a bright lip
 * round a dished silver rim, and dark openings between slim spokes, so a
 * rolling wheel visibly turns. Ten spokes on the finer tiers, five on Low.
 * Light enough to draw a few hundred at once.
 */
export function trafficWheelGeometry(radius: number, segments: number): THREE.BufferGeometry {
  const h = WIDTH / 2;
  const rim = radius * 0.66;
  const lip = rim + 0.012;
  const inner = lathe([[[rim, -h + 0.01], [radius - 0.02, -h]]], segments);
  const tread = lathe([[[radius - 0.02, -h], [radius, -h + 0.045], [radius, h - 0.045], [radius - 0.02, h]]], segments);
  const wall = lathe([[[radius - 0.02, h], [radius - 0.06, h + 0.01], [lip, h + 0.002]]], segments);
  const ring = lathe([[[lip, h + 0.002], [rim - 0.006, h - 0.004]]], segments);
  const face = lathe([[[rim - 0.006, h - 0.004], [rim * 0.62, h - dish(rim * 0.62, rim)], [rim * 0.26, h - dish(rim * 0.26, rim)]]], segments);
  const hub = lathe([[[rim * 0.26, h - dish(rim * 0.26, rim) + 0.003], [0.001, h - 0.02]]], Math.max(8, segments >> 1));
  const spokes = segments >= 16 ? 10 : 5;
  const holes: THREE.BufferGeometry[] = [];
  for (let k = 0; k < spokes; k++) holes.push(spokeGap(rim, h, (k / spokes) * Math.PI * 2, spokes));
  const parts = [bakeLook(inner, ['wall']), bakeLook(tread, ['tire']), bakeLook(wall, ['wall']), bakeLook(ring, ['lip']), bakeLook(face, ['rim']), bakeLook(hub, ['hub']), ...holes.map((g) => bakeLook(g, ['gap']))];
  const merged = merge(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * One dark opening between two spokes, lying just proud of the dish: wide
 * under the rim, narrowing toward the hub where the spokes crowd together,
 * so the spokes between keep an even width.
 */
function spokeGap(rim: number, h: number, a: number, spokes: number): THREE.BufferGeometry {
  const r0 = rim * 0.36;
  const r1 = rim * 0.9;
  const half = (Math.PI / spokes) * (spokes > 5 ? 0.56 : 0.62);
  const rows: Vec3[][] = [];
  for (let i = 0; i <= 2; i++) {
    const r = r0 + ((r1 - r0) * i) / 2;
    const w = half * (0.45 + 0.55 * (i / 2));
    const row: Vec3[] = [];
    for (let j = 0; j <= 2; j++) {
      const t = a - w + (2 * w * j) / 2;
      row.push([r * Math.cos(t), r * Math.sin(t), h - dish(r, rim) + 0.0025]);
    }
    rows.push(row);
  }
  return gridGeometry(rows);
}
