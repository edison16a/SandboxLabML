import type * as THREE from 'three';
import { bowed } from './curve';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin, Slot } from './parts';
import { ARCHED_BANDS, archFloor, NOSE, sectionAt, stations, TAIL } from './profile';
import { warp } from './warp';

/** Slot of each band, sill to centerline: the dark cladding, then paint all the way over. */
const BAND_SLOTS: Slot[] = ['clad', 'paint', 'paint', 'paint', 'paint', 'paint'];
const FINE = 48;

/** Where the side skin meets the arch line at x, as (z, y), or null between the wheels. */
export function archCut(x: number): [number, number] | null {
  const floor = archFloor(x);
  if (floor < 0) return null;
  const s = sectionAt(x);
  for (let band = 0; band < ARCHED_BANDS; band++) {
    const pts = bowed(s.keys[band], s.keys[band + 1], s.bulge[band], FINE);
    for (let i = 0; i < FINE; i++) {
      const [z0, y0] = pts[i];
      const [z1, y1] = pts[i + 1];
      if (y0 <= floor && y1 > floor) {
        const t = (floor - y0) / (y1 - y0);
        return [z0 + (z1 - z0) * t, floor];
      }
    }
  }
  return null;
}

/** Evenly spaced points along a polyline, by arc length. */
function resample(pts: Array<[number, number]>, steps: number): Array<[number, number]> {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1] || 1;
  const out: Array<[number, number]> = [];
  let j = 0;
  for (let i = 0; i <= steps; i++) {
    const d = (total * i) / steps;
    while (j < pts.length - 2 && acc[j + 1] < d) j++;
    const t = (d - acc[j]) / (acc[j + 1] - acc[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  return out;
}

/**
 * Points of one band of the section at x, in (z, y). Where an arch cuts
 * the band, the part below the arch line is dropped and the rest is
 * resampled evenly, so the skin ends cleanly on the arch with no folded
 * flaps. A band entirely below the arch shrinks to the cut point.
 */
export function bandPoints(x: number, band: number, steps: number): Array<[number, number]> {
  const s = sectionAt(x);
  const cut = band < ARCHED_BANDS ? archCut(x) : null;
  if (!cut || s.keys[band][1] >= cut[1]) return bowed(s.keys[band], s.keys[band + 1], s.bulge[band], steps);
  if (s.keys[band + 1][1] <= cut[1]) return Array.from({ length: steps + 1 }, () => [...cut] as [number, number]);
  const dense = bowed(s.keys[band], s.keys[band + 1], s.bulge[band], FINE).filter(([, y]) => y > cut[1]);
  return resample([cut, ...dense], steps);
}

/**
 * The body shell, sill to centerline, one grid per band on each side.
 * Bands meet at creases: smooth inside a panel, crisp between panels.
 */
export function addBody(bin: PartBin, detail: Detail): void {
  const xs = stations(detail.stations, detail.archSteps);
  detail.bands.forEach((steps, band) => {
    const rows = xs.map((x) => bandPoints(x, band, steps).map(([z, y]) => warp([x, y, z])));
    bin.add(BAND_SLOTS[band], bothSides(gridGeometry(rows)));
  });
  bin.add('paint', endCap(NOSE, detail, 1));
  bin.add('paint', endCap(TAIL, detail, -1));
}

/**
 * The face closing the nose or the tail, a fan of rows from a center point
 * out to the last section's outline, so the warp bends it exactly like
 * the lamps and grille that sit on it.
 */
function endCap(x: number, detail: Detail, facing: 1 | -1): THREE.BufferGeometry {
  const half: Array<[number, number]> = [];
  detail.bands.forEach((steps, band) => {
    const pts = bandPoints(x, band, steps);
    half.push(...(band === 0 ? pts : pts.slice(1)));
  });
  const ring = [...half, ...half.slice(0, -1).reverse().map(([z, y]) => [-z, y] as [number, number]), half[0]];
  const cy = (half[0][1] + half[half.length - 1][1]) / 2;
  const n = detail.fine ? 6 : 3;
  const rows = ring.map(([z, y]) => Array.from({ length: n + 1 }, (_, i) => warp([x, cy + ((y - cy) * i) / n, (z * i) / n])));
  const g = gridGeometry(rows);
  const nx = g.attributes.normal.getX(rows[0].length * Math.floor(rows.length / 2) + n);
  return nx * facing < 0 ? gridGeometry(rows.reverse()) : g;
}

/** A point on the nose (+1) or tail (-1) face at (z, y), lifted off it by `lift` m. */
export function onCap(end: 1 | -1, z: number, y: number, lift = 0.004): Vec3 {
  return warp([(end > 0 ? NOSE : TAIL) + end * lift, y, z]);
}

/**
 * A point on the body surface: band `band` of the section at x, a share
 * `t` of the way from its lower key to its upper key, lifted along the
 * band's outward normal. Lamps and trim use this to sit on the paint.
 */
export function onBody(x: number, band: number, t: number, lift = 0): Vec3 {
  const s = sectionAt(x);
  const pts = bowed(s.keys[band], s.keys[band + 1], s.bulge[band], 64);
  const f = Math.min(Math.max(t, 0), 1) * 64;
  const i = Math.min(63, Math.floor(f));
  const [p, q] = [pts[i], pts[i + 1]];
  const k = f - i;
  const dz = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dz, dy) || 1;
  return warp([x, p[1] + dy * k - (dz / len) * lift, p[0] + dz * k + (dy / len) * lift]);
}
