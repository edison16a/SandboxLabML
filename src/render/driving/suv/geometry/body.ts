import type * as THREE from 'three';
import { endFace, faceNormal } from './face';
import { bothSides, gridGeometry } from './grid';
import { intakeCut } from './intakes';
import type { Detail, PartBin, Slot } from './parts';
import { ARCHED_BANDS, archFloor, NOSE, sectionAt, stations, TAIL } from './profile';
import { along, resample, span, type Pt } from './section';
import { warp } from './warp';

/**
 * Bands joined into one smooth grid each: the gloss black sill trim, the
 * lower side, the side up to the shoulder, and everything from the
 * shoulder crease over the top. The side and the shoulder meet where the
 * surface stands upright, and their normals are welded there, so the seam
 * never shows; the arch cuts in the side never disturb the shoulder.
 */
const PANELS: Array<{ bands: number[]; slot: Slot }> = [
  { bands: [0], slot: 'trim' },
  { bands: [1], slot: 'paint' },
  { bands: [2], slot: 'paint' },
  { bands: [3, 4, 5, 6], slot: 'paint' },
];
const FINE = 24;

/** Points of one band of the section at x, in (z, y). */
export function bandCurve(x: number, band: number, steps: number): Pt[] {
  const k = sectionAt(x).keys;
  return span(k[band], k[band + 1], steps);
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

/** Points across one panel of the section at x, band after band, each band keeping its own share of the points. */
function panelPoints(x: number, bands: number[], counts: number[]): Pt[] {
  return bands.flatMap((b, i) => cutBand(x, b, counts[b]).slice(i === 0 ? 0 : 1));
}

/** The body shell, sill to centerline, one grid per panel on each side, and the two end faces. */
export function addBody(bin: PartBin, detail: Detail): void {
  const xs = stations(detail.stations, detail.archSteps);
  const last = xs.length - 1;
  const grids: THREE.BufferGeometry[] = [];
  for (const panel of PANELS) {
    const raw = xs.map((x) => panelPoints(x, panel.bands, detail.bands));
    const g = gridGeometry(raw.map((row, i) => row.map(([z, y]) => warp([xs[i], y, z]))));
    // The end rows have curled round to face straight back and forward: give them the faces' own normals, so the corner and the face shade as one.
    const n = g.attributes.normal;
    const cols = raw[0].length;
    raw[0].forEach(([z, y], j) => n.setXYZ(j, ...faceNormal(-1, xs[0], y, z)));
    raw[last].forEach(([z, y], j) => n.setXYZ(last * cols + j, ...faceNormal(1, xs[last], y, z)));
    grids.push(g);
  }
  weld(grids[2], grids[3], xs.length);
  grids.forEach((g, i) => bin.add(PANELS[i].slot, bothSides(g)));
  const cut = detail.fine || detail.brakes ? intakeCut(detail) : undefined;
  bin.add('paint', endFace(1, NOSE, outline(NOSE, detail), detail, cut));
  bin.add('paint', endFace(-1, TAIL, outline(TAIL, detail), detail));
}

/**
 * Where the side meets the shoulder panel, the shoulder's own first
 * column only sees the crease's tight radius above it and leans its
 * normals up. The side's normals there are the surface's true ones, so
 * the shoulder takes them and the two shade as one sheet.
 */
function weld(side: THREE.BufferGeometry, top: THREE.BufferGeometry, rows: number): void {
  const a = side.attributes.normal;
  const b = top.attributes.normal;
  const ca = a.count / rows;
  const cb = b.count / rows;
  for (let i = 0; i < rows; i++) b.setXYZ(i * cb, a.getX(i * ca + ca - 1), a.getY(i * ca + ca - 1), a.getZ(i * ca + ca - 1));
}

/** The outline of the section at x from sill to centerline, as the body's panels draw it. */
export function outline(x: number, detail: Detail): Pt[] {
  return PANELS.flatMap((p, i) => panelPoints(x, p.bands, detail.bands).slice(i === 0 ? 0 : 1));
}

/** A point on the body surface: band `band` of the section at x, a share `t` of the way along it, lifted along its outward normal. */
export function onBody(x: number, band: number, t: number, lift = 0): [number, number, number] {
  const { p, n } = along(bandCurve(x, band, 48), t);
  return warp([x, p[1] + n[1] * lift, p[0] + n[0] * lift]);
}
