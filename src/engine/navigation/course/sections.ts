import { snap, type CourseDraft } from './draft';
import { MOVER_SPEED_LIMIT } from './movers';
import { INNER_WALL, type MoverSpec, type Rect } from './types';

/** Crate footprints a block may take, as half sizes, m: a cube, a big cube, a plank each way and a wide crate. */
const BLOCK_SIZES: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.5],
  [0.65, 0.65],
  [0.5, 1.1],
  [1.1, 0.5],
  [0.9, 0.9],
];
/** Narrowest walkable gap a level makes, m: two agent widths. */
export const MIN_GAP = 1.7;
/** Tries per piece before a section gives up on it. */
export const TRIES = 40;
/** Shortest wall left between an opening and a side wall, m. A shorter piece reads as a mistake, so the opening runs to the wall instead. */
export const MIN_STUB = 1.2;

/**
 * Moves an opening [lo, hi] across a room of half width `half` so the wall
 * left on each side is either none or at least MIN_STUB: a short stub
 * shifts the opening onto the side wall, a longer one shifts it away.
 * Its width is kept and its edges are snapped to 10 cm, so the wall
 * pieces either side have tidy 5 cm centers and sizes.
 */
export function settleOpening(lo: number, hi: number, half: number): [number, number] {
  let shift = 0;
  const left = lo + half;
  const right = half - hi;
  if (left > 1e-9 && left < MIN_STUB) shift = left < MIN_STUB / 2 ? -left : MIN_STUB - left;
  else if (right > 1e-9 && right < MIN_STUB) shift = right < MIN_STUB / 2 ? right : right - MIN_STUB;
  return [snap(Math.max(-half, lo + shift), 10), snap(Math.min(half, hi + shift), 10)];
}

/** One big crate across the middle of the room at about x, so the straight line is blocked. */
export function bigBlock(d: CourseDraft, x: number): void {
  for (let t = 0; t < TRIES; t++) {
    const r: Rect = { x: snap(x + d.rng.range(-1.5, 1.5)), z: snap(d.rng.range(-1.2, 1.2)), hx: snap(d.rng.range(0.8, 1.2)), hz: snap(d.rng.range(1.5, 2.6)) };
    if (!d.fits(r, MIN_GAP)) continue;
    d.add({ kind: 'block', ...r, height: 1.2 }, r);
    return;
  }
}

/** Up to `count` crates scattered between x0 and x1, each at least `gap` m from the rest. */
export function blockField(d: CourseDraft, x0: number, x1: number, count: number, gap = 1): void {
  let placed = 0;
  for (let t = 0; t < count * TRIES && placed < count; t++) {
    const [hx, hz] = d.rng.pick(BLOCK_SIZES);
    const r: Rect = { x: snap(d.rng.range(x0 + hx, x1 - hx)), z: snap(d.rng.range(-d.width / 2 + hz, d.width / 2 - hz)), hx, hz };
    if (!d.fits(r, gap)) continue;
    d.add({ kind: 'block', ...r, height: hx === hz && hx > 0.6 ? 1.2 : 1 }, r);
    placed++;
  }
}

/** A wall across the room at x with `gaps` openings (1 or 2), each MIN_GAP to MIN_GAP + 0.7 wide, at least 3 m apart. */
export function wallWithGaps(d: CourseDraft, x: number, gaps: number): void {
  const half = d.width / 2;
  for (let t = 0; t < TRIES; t++) {
    const openings: Array<[number, number]> = [];
    for (let g = 0; g < gaps; g++) {
      const w = d.rng.range(MIN_GAP, MIN_GAP + 0.7);
      const c = d.rng.range(-half + w / 2 + 0.3, half - w / 2 - 0.3);
      openings.push(settleOpening(c - w / 2, c + w / 2, half));
    }
    openings.sort((a, b) => a[0] - b[0]);
    if (openings.some((o, i) => i > 0 && o[0] - openings[i - 1][1] < 3)) continue;
    const segments: Rect[] = [];
    let from = -half;
    for (const [a, b] of [...openings, [half, half] as [number, number]]) {
      if (a - from > 0.05) segments.push({ x: snap(x), z: snap((from + a) / 2), hx: INNER_WALL / 2, hz: snap((a - from) / 2) });
      from = b;
    }
    // Each segment keeps a step of floor clear on both faces, so nothing blocks a gap from behind.
    if (!segments.every((s) => d.fits(s, 1.2, true))) continue;
    for (const s of segments) d.add({ kind: 'wall', ...s }, s);
    for (const [a, b] of openings) d.reserve({ x: snap(x), z: (a + b) / 2, hx: 1.6, hz: (b - a) / 2 });
    return;
  }
}

/** Period that keeps a mover of this travel under the speed limit, with a random slack so movers drift out of step. */
function moverPeriod(d: CourseDraft, travel: number): number {
  const fastest = (Math.PI * travel) / (2 * MOVER_SPEED_LIMIT * 0.92);
  return snap(Math.max(2.2, fastest) * d.rng.range(1, 1.35));
}

/**
 * A mover patrolling across the room at x. With a wall, it slides to and
 * fro in an opening of the wall, so agents must time their dash through;
 * at each end of its travel it stops a hair short of the wall, where an
 * agent caught is crushed. Without one, it sweeps a lane of open floor.
 */
export function moverGate(d: CourseDraft, x: number, withWall: boolean): void {
  const half = d.width / 2;
  for (let t = 0; t < TRIES; t++) {
    const hz = snap(d.rng.range(0.7, 0.95));
    const hx = 0.6;
    const open = withWall ? d.rng.range(4.4, 5.4) : d.rng.range(4.5, 7.5);
    const c = d.rng.range(-half + open / 2 + 0.4, half - open / 2 - 0.4);
    const [lo, hi] = withWall ? settleOpening(c - open / 2, c + open / 2, half) : [c - open / 2, c + open / 2];
    const az = snap(lo + hz + (withWall ? 0.08 : 0));
    const bz = snap(hi - hz - (withWall ? 0.08 : 0));
    const flip = d.rng.chance(0.5);
    const m: MoverSpec = { kind: 'mover', hx, hz, height: 1, ax: snap(x), az: flip ? bz : az, bx: snap(x), bz: flip ? az : bz, period: moverPeriod(d, bz - az), phase: snap(d.rng.next()) };
    const sweep: Rect = { x: snap(x), z: (az + bz) / 2, hx, hz: (bz - az) / 2 + hz };
    const walls: Rect[] = [];
    if (withWall) {
      if (lo + half > 0.05) walls.push({ x: snap(x), z: snap((-half + lo) / 2), hx: INNER_WALL / 2, hz: snap((lo + half) / 2) });
      if (half - hi > 0.05) walls.push({ x: snap(x), z: snap((hi + half) / 2), hx: INNER_WALL / 2, hz: snap((half - hi) / 2) });
    }
    if (!d.fits(sweep, 1.4, withWall) || !walls.every((w) => d.fits(w, 1.2, true))) continue;
    for (const w of walls) d.add({ kind: 'wall', ...w }, w);
    d.add(m, sweep);
    return;
  }
}
