import * as THREE from 'three';
import { bowed } from '../suv/geometry/curve';
import { bothSides, gridGeometry, merge, polygonGeometry, type Vec3 } from '../suv/geometry/grid';
import type { CarShape } from './shapes';
import { bakeLook, LAMP, type Look } from './looks';

/** Body bands: dark rocker, lower door, upper door, side glass or pillar, top (roof, hood, deck or glass). */
const BANDS = 5;

/** Section keys at x, sill up to the centerline. */
function keysAt(s: CarShape, x: number): Array<[number, number]> {
  const w = s.halfWidth(x);
  const h = s.length / 2;
  const belt = s.beltY(x);
  const lift = 0.1 * Math.max(0, (Math.abs(x) - (h - 0.7)) / 0.7);
  return [
    [w - 0.05, 0.24 + lift],
    [w - 0.01, 0.42],
    [w, belt - 0.13],
    [w - 0.05, belt],
    [Math.min(s.topZ(x), w - 0.06), Math.max(belt + 0.01, s.topY(x) - 0.035)],
    [0, Math.max(belt + 0.02, s.topY(x))],
  ];
}

/** The wheel opening's top edge at x, or -1 away from the wheels. */
function archFloor(s: CarShape, x: number): number {
  const r = s.wheelRadius + 0.09;
  for (const axle of [s.wheelbase / 2, -s.wheelbase / 2]) {
    const d = Math.abs(x - axle);
    if (d < r) return s.wheelRadius + Math.sqrt(r * r - d * d);
  }
  return -1;
}

/** Points of one band at x, dropping what lies inside a wheel opening and spreading the rest evenly. */
function bandPoints(s: CarShape, x: number, band: number, steps: number): Array<[number, number]> {
  const k = keysAt(s, x);
  const pts = bowed(k[band], k[band + 1], band === 4 ? 0.02 : 0.008, steps);
  const floor = band < 3 ? archFloor(s, x) : -1;
  if (floor < 0 || k[band][1] >= floor) return pts;
  if (k[band + 1][1] <= floor) return pts.map(() => [k[band + 1][0], floor] as [number, number]);
  const t = (floor - k[band][1]) / (k[band + 1][1] - k[band][1]);
  return bowed([k[band][0] + (k[band + 1][0] - k[band][0]) * t, floor], k[band + 1], 0.008, steps);
}

/** Which look a band takes at x: glass where the windows are, paint elsewhere, a dark rocker at the bottom. */
function lookAt(s: CarShape, x: number, band: number): Look {
  if (band === 0) return 'plastic';
  const inside = (r: [number, number]) => x > r[0] && x < r[1];
  if (band === 3) return inside(s.sideGlass) ? 'glass' : 'paint';
  if (band === 4) return inside(s.windshield) || inside(s.rearGlass) ? 'glass' : 'paint';
  return 'paint';
}

/** Even stations plus a pair at every glass edge, so paint and glass meet at a crisp line. */
function stations(s: CarShape, count: number): number[] {
  const h = s.length / 2;
  const xs: number[] = [];
  for (let i = 0; i <= count; i++) xs.push(-h + (2 * h * i) / count);
  for (const r of [s.sideGlass, s.windshield, s.rearGlass]) for (const e of r) if (Math.abs(e) < h - 0.01) xs.push(e - 0.002, e + 0.002);
  for (const axle of [s.wheelbase / 2, -s.wheelbase / 2]) for (let i = 0; i <= 8; i++) xs.push(axle - (s.wheelRadius + 0.09) * Math.cos((Math.PI * i) / 8));
  xs.sort((a, b) => a - b);
  return xs.filter((x, i) => i === 0 || x - xs[i - 1] > 0.001);
}

/**
 * One traffic car body, lamps included, with every look baked into vertex
 * attributes so a whole body type draws in one instanced call. `count` is
 * the number of stations along the car.
 */
export function carBodyGeometry(s: CarShape, count: number, steps: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const xs = stations(s, count);
  for (let band = 0; band < BANDS; band++) {
    const rows: Vec3[][] = xs.map((x) => bandPoints(s, x, band, steps).map(([z, y]) => [x, y, z] as Vec3));
    const g = gridGeometry(rows);
    // Each row of vertices takes the look of its station.
    const looks = xs.flatMap((x) => Array.from({ length: steps + 1 }, () => lookAt(s, x, band)));
    parts.push(bothSides(bakeLook(g, looks)));
  }
  const h = s.length / 2;
  for (const end of [1, -1] as const) {
    const x = end * h;
    const half = Array.from({ length: BANDS }, (_, b) => bandPoints(s, x, b, 1)).flatMap((p, b) => (b === 0 ? p : p.slice(1)));
    const ring: Vec3[] = [...half.map(([z, y]) => [x, y, z] as Vec3), ...half.slice(0, -1).reverse().map(([z, y]) => [x, y, -z] as Vec3)];
    parts.push(bakeLook(polygonGeometry(ring, [end, 0, 0]), ['paint']));
    parts.push(...lamps(s, end));
  }
  // Dark wells behind the wheels, so the openings show shadow and not the far side.
  for (const axle of [s.wheelbase / 2, -s.wheelbase / 2]) {
    const well = new THREE.PlaneGeometry(2 * (s.wheelRadius + 0.09), s.wheelRadius * 2 + 0.1).translate(axle, s.wheelRadius + 0.05, s.width / 2 - 0.28);
    parts.push(bothSides(bakeLook(well, ['well'])));
  }
  if (s.roofSign) parts.push(bakeLook(new THREE.BoxGeometry(0.62, 0.16, 0.22).translate(-0.05, s.topY(0) + 0.08, 0), ['sign'], LAMP.sign));
  const merged = merge(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** Head and tail lamps and the indicators beside them, as small quads proud of the end faces. */
function lamps(s: CarShape, end: 1 | -1): THREE.BufferGeometry[] {
  const x = end * (s.length / 2 + 0.006);
  const belt = s.beltY(end * s.length / 2);
  const w = s.halfWidth(end * s.length / 2);
  const y0 = belt - 0.17;
  const out: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    const lamp = new THREE.PlaneGeometry(0.34, 0.11).rotateY((end * Math.PI) / 2).translate(x, y0, side * (w - 0.26));
    out.push(bakeLook(lamp, [end > 0 ? 'head' : 'tail'], end > 0 ? LAMP.head : LAMP.tail));
    const ind = new THREE.PlaneGeometry(0.1, 0.07).rotateY((end * Math.PI) / 2).translate(x, y0, side * (w - 0.05));
    out.push(bakeLook(ind, ['amber'], side > 0 ? LAMP.left : LAMP.right));
  }
  return out;
}
