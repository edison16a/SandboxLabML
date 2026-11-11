import type * as THREE from 'three';
import { onCabin } from './cabin';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';

/** The side glass sits between these shares of the cabin's side band, belt to roof rail. */
const GLASS_LOW = 0.07;
const GLASS_TOP = 0.86;
/** The bright surround runs just above the glass and along the belt. */
const FRAME = 0.05;

/**
 * The windows' top edge at x, as a share of the side band: level along the
 * doors, then sweeping down to a point at the back of the rear quarter
 * window, the coupe line that ends in a thick painted C pillar.
 */
function topAt(x: number): number {
  if (x > QUARTER.from) return GLASS_TOP;
  const k = Math.min(1, (QUARTER.from - x) / (QUARTER.from - QUARTER.to));
  return GLASS_LOW + (GLASS_TOP - GLASS_LOW) * (1 - k ** 1.7);
}

/** Door and quarter window spans along the car, m; the B pillar and a slim divider sit between them. */
const FRONT = { from: -0.12, to: 0.93 };
const REAR = { from: -0.94, to: -0.25 };
const QUARTER = { from: -1.01, to: -1.6 };

/** A strip on the side band from x0 to x1 between shares t0(x) and t1(x), lifted off the paint. */
function sidePanel(x0: number, x1: number, t0: (x: number) => number, t1: (x: number) => number, lift: number, steps: number, across = 2): THREE.BufferGeometry {
  const rows: Vec3[][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const a = t0(x);
    const b = t1(x);
    rows.push(Array.from({ length: across + 1 }, (_, j) => onCabin(x, 0, a + ((b - a) * j) / across, lift)));
  }
  return bothSides(gridGeometry(rows));
}

const at = (v: number) => () => v;

/**
 * The glasshouse detail over the painted cabin: three windows a side, a
 * gloss black B pillar and divider, and a bright surround above the glass
 * and along the belt. With the pillars and roof in paint, the SUV reads as
 * a tall body with a band of glass, not as a low car under a dark canopy.
 */
export function addWindows(bin: PartBin, detail: Detail): void {
  const n = detail.fine ? 28 : 10;
  bin.add('glass', sidePanel(FRONT.from, FRONT.to, at(GLASS_LOW), at(GLASS_TOP), 0.004, n));
  bin.add('glass', sidePanel(REAR.from, REAR.to, at(GLASS_LOW), at(GLASS_TOP), 0.004, Math.round(n * 0.7)));
  bin.add('glass', sidePanel(QUARTER.to, QUARTER.from, at(GLASS_LOW), topAt, 0.004, Math.round(n * 0.6)));
  bin.add('trim', sidePanel(REAR.to, FRONT.from, at(0), at(1), 0.006, 2));
  bin.add('trim', sidePanel(QUARTER.from, REAR.from, at(GLASS_LOW - 0.02), at(GLASS_TOP + 0.01), 0.005, 1));
  // The surround: over the top of every window and down into the C pillar, and along the belt.
  const top = (x: number) => topAt(x) + 0.008;
  bin.add('metal', sidePanel(QUARTER.to - 0.02, FRONT.to, top, (x) => top(x) + FRAME, 0.006, n * 2, 1));
  bin.add('metal', sidePanel(QUARTER.to, FRONT.to + 0.04, at(0.0), at(FRAME * 0.8), 0.006, n * 2, 1));
}

/** Low gloss black rails along the roof edges, standing on a foot at each end. */
export function addRoofRails(bin: PartBin, detail: Detail): void {
  const n = detail.fine ? 30 : 10;
  const x0 = -1.3;
  const x1 = 0.18;
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    // Rises off the roof just inside each end, so the rail floats on two feet.
    const end = Math.min(1, Math.min(x - x0, x1 - x) / 0.12);
    const h = 0.012 + 0.026 * end;
    rows.push([onCabin(x, 2, 0.1, 0.002), onCabin(x, 2, 0.1, h), onCabin(x, 2, 0.16, h + 0.004), onCabin(x, 2, 0.22, h), onCabin(x, 2, 0.22, 0.002)]);
  }
  bin.add('trim', bothSides(gridGeometry(rows)));
}

/** A dark panoramic glass panel set into the painted roof, the view the chase camera sees most. */
export function addSunroof(bin: PartBin, detail: Detail): void {
  const n = detail.fine ? 20 : 6;
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const x = -0.9 + (1.12 * i) / n;
    rows.push(Array.from({ length: 5 }, (_, j) => onCabin(x, 2, 0.34 + (0.66 * j) / 4, 0.003)));
  }
  bin.add('glass', bothSides(gridGeometry(rows)));
}
