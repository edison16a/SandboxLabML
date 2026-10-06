import type * as THREE from 'three';
import { archFloor, BODY, sectionAt, stations } from './bodyProfile';
import { bowed } from './curve';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin, Slot } from './parts';
import { warp } from './warp';

/** Slot of each section band, sill to roof: carbon skirt, four painted bands, two carbon hood facets. */
const BAND_SLOTS: Slot[] = ['carbon', 'paint', 'paint', 'paint', 'paint', 'carbon', 'carbon'];
/** Bands low enough to meet the wheels, which the arches cut away. */
export const ARCHED_BANDS = 4;
const FINE = 48;

/**
 * Where the side skin meets the arch line at x, as (z, y), or null between
 * the wheels. Side bands rise steadily, so the first crossing is the cut.
 */
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

/**
 * Points of one band of the section at x, in (z, y). Where a wheel arch
 * cuts the band, the part below the arch line is dropped and the rest is
 * resampled evenly, so the skin ends cleanly on the arch with no folded
 * flaps to spoil the shading. A band entirely below the arch shrinks to
 * the cut point and draws nothing.
 */
export function bandPoints(x: number, band: number, steps: number): Array<[number, number]> {
  const s = sectionAt(x);
  const cut = band < ARCHED_BANDS ? archCut(x) : null;
  if (!cut || s.keys[band][1] >= cut[1]) return bowed(s.keys[band], s.keys[band + 1], s.bulge[band], steps);
  if (s.keys[band + 1][1] <= cut[1]) return Array.from({ length: steps + 1 }, () => [...cut] as [number, number]);
  const dense = bowed(s.keys[band], s.keys[band + 1], s.bulge[band], FINE).filter(([, y]) => y > cut[1]);
  return resample([cut, ...dense], steps);
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
 * The painted shell, sill to roof centerline, as one grid per band on each
 * side. Bands meet at creases, which is what gives the body its cut,
 * faceted look: smooth inside a panel, sharp between panels.
 */
export function addBody(bin: PartBin, detail: Detail): void {
  const xs = stations(detail.stations, detail.archSteps);
  detail.bands.forEach((steps, band) => {
    const rows = xs.map((x) => bandPoints(x, band, steps).map(([z, y]) => warp([x, y, z])));
    bin.add(BAND_SLOTS[band], bothSides(gridGeometry(rows)));
  });
  bin.add('paint', endCap(BODY.nose, detail, 1));
  bin.add('trim', endCap(BODY.tail, detail, -1));
}

/**
 * The face that closes the nose or the tail, traced from the last section
 * all the way round. It is a fan of rows from a center point out to the
 * outline rather than a flat polygon, so the warp bends it exactly like
 * the lamps and intakes that sit on it.
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
  // Rows walk the outline, columns run from the center out; flip the row order if the face points inward.
  const rows = ring.map(([z, y]) => Array.from({ length: n + 1 }, (_, i) => warp([x, cy + ((y - cy) * i) / n, (z * i) / n])));
  const g = gridGeometry(rows);
  const nx = g.attributes.normal.getX(rows[0].length * Math.floor(rows.length / 2) + n);
  return nx * facing < 0 ? gridGeometry(rows.reverse()) : g;
}

/** A point on the nose (+1) or tail (-1) face at (z, y), lifted off it by `lift` meters. */
export function onCap(end: 1 | -1, z: number, y: number, lift = 0.003): Vec3 {
  return warp([(end > 0 ? BODY.nose : BODY.tail) + end * lift, y, z]);
}

/**
 * A point on the body surface: band `band` of the section at x, a fraction
 * `t` of the way from its lower key to its upper key. Decals and trim use
 * this to sit exactly on the paint.
 */
export function onBody(x: number, band: number, t: number, lift = 0): Vec3 {
  const s = sectionAt(x);
  const pts = bowed(s.keys[band], s.keys[band + 1], s.bulge[band], 64);
  const f = Math.min(Math.max(t, 0), 1) * 64;
  const i = Math.min(63, Math.floor(f));
  const [p, q] = [pts[i], pts[i + 1]];
  const k = f - i;
  // Lift along the band's local outward normal so trim floats just above the paint.
  const dz = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dz, dy) || 1;
  return warp([x, p[1] + dy * k - (dz / len) * lift, p[0] + dz * k + (dy / len) * lift]);
}
