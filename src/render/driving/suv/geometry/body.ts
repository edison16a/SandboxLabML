import { endFace, faceNormal } from './face';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin, Slot } from './parts';
import { ARCHED_BANDS, archFloor, NOSE, sectionAt, stations, TAIL } from './profile';
import { along, resample, span, type Pt } from './section';
import { warp } from './warp';

/**
 * Bands joined into one smooth grid each: the gloss black rocker, the
 * dished lower door, the side up to the shoulder, and the shoulder roll
 * over the top. The side and the shoulder meet where the surface stands
 * vertical, so the seam never shows, and the arch cuts in the side never
 * disturb the shading of the roll above them.
 */
const PANELS: Array<{ bands: number[]; slot: Slot }> = [
  { bands: [0], slot: 'trim' },
  { bands: [1], slot: 'paint' },
  { bands: [2], slot: 'paint' },
  { bands: [3, 4, 5], slot: 'paint' },
];
const FINE = 24;

/** Handle tension of each band: the shoulder roll is drawn a little tauter than a plain curve. */
const TENSION = [1, 1, 1, 0.85, 1, 1];

/** Points of one band of the section at x, in (z, y). */
export function bandCurve(x: number, band: number, steps: number): Pt[] {
  const k = sectionAt(x).keys;
  return span(k[band], k[band + 1], steps, TENSION[band]);
}

/** Where the side skin meets the arch line at x, as (z, y), or null between the wheels. */
export function archCut(x: number): Pt | null {
  const floor = archFloor(x);
  if (floor < 0) return null;
  for (let band = 0; band < ARCHED_BANDS; band++) {
    const pts = bandCurve(x, band, FINE);
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
 * Points of one band at x, cut by the arch. Where an arch cuts the band,
 * the part below the arch line is dropped and the rest resampled evenly,
 * so the skin ends cleanly on the arch with no folded flaps. A band wholly
 * below the arch shrinks to the cut point.
 */
function cutBand(x: number, band: number, steps: number): Pt[] {
  const pts = bandCurve(x, band, FINE);
  const cut = band < ARCHED_BANDS ? archCut(x) : null;
  if (!cut || pts[0][1] >= cut[1]) return resample(pts, steps);
  if (pts[FINE][1] <= cut[1]) return Array.from({ length: steps + 1 }, () => [...cut] as Pt);
  return resample([cut, ...pts.filter(([, y]) => y > cut[1])], steps);
}

/**
 * Points across one panel of the section at x, band after band. Each band
 * keeps its own share of the points, so the bands above the arches sample
 * the same way at every station and the shoulder's highlight runs clean.
 */
function panelPoints(x: number, bands: number[], counts: number[]): Pt[] {
  return bands.flatMap((b, i) => cutBand(x, b, counts[b]).slice(i === 0 ? 0 : 1));
}

/** The body shell, sill to centerline, one grid per panel on each side. */
export function addBody(bin: PartBin, detail: Detail): void {
  const xs = stations(detail.stations, detail.archSteps);
  const last = xs.length - 1;
  for (const panel of PANELS) {
    const raw = xs.map((x) => panelPoints(x, panel.bands, detail.bands));
    const g = gridGeometry(raw.map((row, i) => row.map(([z, y]) => warp([xs[i], y, z]))));
    // The end rows have curled round to face straight back and forward: give them the faces' own normals, so the corner and the face shade as one.
    const n = g.attributes.normal;
    const cols = raw[0].length;
    raw[0].forEach(([z, y], j) => n.setXYZ(j, ...faceNormal(-1, xs[0], y, z)));
    raw[last].forEach(([z, y], j) => n.setXYZ(last * cols + j, ...faceNormal(1, xs[last], y, z)));
    bin.add(panel.slot, bothSides(g));
  }
  bin.add('paint', endFace(1, NOSE, outline(NOSE, detail), detail));
  bin.add('paint', endFace(-1, TAIL, outline(TAIL, detail), detail));
}

/** The outline of the section at x from sill to centerline, as the body's panels draw it. */
export function outline(x: number, detail: Detail): Pt[] {
  return PANELS.flatMap((p, i) => panelPoints(x, p.bands, detail.bands).slice(i === 0 ? 0 : 1));
}

const tops = new Map<number, Pt[]>();

/**
 * Height of the top edge of the nose (+1) or tail (-1) face at z: where
 * the hood or the deck meets it. Lamps that hug the top corners follow it.
 */
export function faceTop(end: 1 | -1, z: number): number {
  let top = tops.get(end);
  if (!top) {
    const k = sectionAt(end > 0 ? NOSE : TAIL).keys;
    top = [...span(k[3], k[4], 24, TENSION[3]), ...span(k[4], k[5], 16).slice(1), ...span(k[5], k[6], 16).slice(1)];
    tops.set(end, top);
  }
  const a = Math.abs(z);
  for (let i = 0; i < top.length - 1; i++) {
    const [z0, y0] = top[i];
    const [z1, y1] = top[i + 1];
    if (a <= z0 && a >= z1) return y0 + ((y1 - y0) * (a - z0)) / (z1 - z0 || 1);
  }
  return top[0][1];
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
  const { p, n } = along(bandCurve(x, band, 48), t);
  return warp([x, p[1] + n[1] * lift, p[0] + n[0] * lift]);
}
