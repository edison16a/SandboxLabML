import type * as THREE from 'three';
import { gridGeometry, merge, type Vec3 } from '../suv/geometry/grid';
import { lathe } from '../suv/geometry/lathe';
import { bakeLook } from './looks';

/** Tire width, m. */
const WIDTH = 0.225;
/** Spokes on the rim. */
const SPOKES = 5;

/** Depth of the rim's dish below the outer face at radius r, m: the face is shallow at the lip and dips toward the hub. */
const dish = (r: number, rim: number) => 0.012 + 0.022 * (1 - r / rim);

/**
 * A traffic car wheel centered on its axle, outer face toward +Z: a black
 * tread, a slightly lighter sidewall with a soft bulge, a silver rim with
 * a shallow dish and five dark openings between its spokes, so a rolling
 * wheel visibly turns. Light enough to draw a few hundred at once.
 */
export function trafficWheelGeometry(radius: number, segments: number): THREE.BufferGeometry {
  const h = WIDTH / 2;
  const rim = radius * 0.64;
  const inner = lathe([[[rim, -h + 0.006], [radius - 0.015, -h]]], segments);
  const tread = lathe([[[radius - 0.015, -h], [radius, -h + 0.035], [radius, h - 0.035], [radius - 0.015, h]]], segments);
  const wall = lathe([[[radius - 0.015, h], [radius - 0.055, h + 0.008], [rim + 0.012, h - 0.002]]], segments);
  const face = lathe([[[rim + 0.012, h - 0.002], [rim - 0.006, h - 0.004], [rim * 0.62, h - dish(rim * 0.62, rim)], [rim * 0.24, h - dish(rim * 0.24, rim)]]], segments);
  const hub = lathe([[[rim * 0.24, h - dish(rim * 0.24, rim) + 0.002], [rim * 0.12, h - 0.022], [0.001, h - 0.024]]], Math.max(8, segments >> 1));
  const holes: THREE.BufferGeometry[] = [];
  for (let k = 0; k < SPOKES; k++) holes.push(spokeGap(rim, h, (k / SPOKES) * Math.PI * 2));
  const parts = [bakeLook(inner, ['wall']), bakeLook(tread, ['tire']), bakeLook(wall, ['wall']), bakeLook(face, ['rim']), bakeLook(hub, ['rim']), ...holes.map((g) => bakeLook(g, ['hub']))];
  const merged = merge(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** One dark opening between two spokes, a rounded wedge lying just proud of the dish. */
function spokeGap(rim: number, h: number, a: number): THREE.BufferGeometry {
  const r0 = rim * 0.34;
  const r1 = rim * 0.9;
  const half = (Math.PI / SPOKES) * 0.58;
  const rows: Vec3[][] = [];
  for (let i = 0; i <= 2; i++) {
    const r = r0 + ((r1 - r0) * i) / 2;
    // The wedge narrows toward the hub, where the spokes crowd together.
    const w = half * (0.55 + 0.45 * (i / 2));
    const row: Vec3[] = [];
    for (let j = 0; j <= 2; j++) {
      const t = a - w + (2 * w * j) / 2;
      row.push([r * Math.cos(t), r * Math.sin(t), h - dish(r, rim) + 0.0025]);
    }
    rows.push(row);
  }
  return gridGeometry(rows);
}
