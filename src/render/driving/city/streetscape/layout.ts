import { Rng } from '@/engine/core/rng';
import { DIR_X, DIR_Y, LANE_OFFSET, ROAD_HALF, STOP_LINE, WALK_LINE, type Dir } from '@/engine/driving/city/dimensions';
import type { City } from '@/engine/driving/city/types';

/** Something placed on the street: a position in sim coordinates and the way it faces (sim heading). */
export interface Spot {
  x: number;
  y: number;
  heading: number;
  /** 0 to 1, for size and variant choices. */
  seed: number;
}

/** A vehicle signal: its pole on the corner and where its head hangs over the lane, for one approach. */
export interface SignalSpot {
  signal: number;
  /** Direction the governed traffic travels (index into the world's per approach lights). */
  dir: Dir;
  pole: Spot;
  /** The head over the lane and the second head on the pole, facing the drivers. */
  head: Spot;
  near: Spot;
}

/** A walk signal at one end of a crossing, facing across the street. */
export interface WalkSpot extends Spot {
  signal: number;
  axis: number;
}

export interface Streetscape {
  lamps: Spot[];
  trees: Spot[];
  benches: Spot[];
  bins: Spot[];
  signals: SignalSpot[];
  walks: WalkSpot[];
}

/** Street furniture sits this far in from the curb, m: the strip between the road and the walking line. */
const FURNITURE = ROAD_HALF + 0.75;
/** Height of the mast arm's signal head, m. */
export const HEAD_HEIGHT = 5.3;
export const NEAR_HEIGHT = 3.0;

/** Lamps, trees, benches and bins along one side of one street segment from a to b. */
function along(out: Streetscape, rng: Rng, ax: number, ay: number, dx: number, dy: number, len: number, side: 1 | -1): void {
  const px = -dy * side;
  const py = dx * side;
  const facing = Math.atan2(-py, -px);
  const at = (s: number, off: number): Spot => ({ x: ax + dx * s + px * off, y: ay + dy * s + py * off, heading: facing, seed: rng.next() });
  const start = 17;
  const end = len - 17;
  if (end - start < 8) return;
  const lamps = Math.max(1, Math.round((end - start) / 30));
  for (let k = 0; k <= lamps; k++) out.lamps.push(at(start + ((end - start) * k) / lamps, FURNITURE - 0.25));
  const trees = Math.max(1, Math.round((end - start) / 15));
  for (let k = 0; k < trees; k++) {
    const s = start + ((end - start) * (k + 0.5)) / trees;
    if (rng.chance(0.85)) out.trees.push(at(s, FURNITURE + 0.2));
    if (rng.chance(0.18)) out.benches.push(at(s + 3.2, FURNITURE + 0.1));
    else if (rng.chance(0.15)) out.bins.push(at(s - 3, FURNITURE - 0.1));
  }
}

/** Signal poles for every approach of a signalized node, and walk signals at both ends of its crossings. */
function junction(out: Streetscape, city: City, n: City['nodes'][number]): void {
  if (n.signal < 0) return;
  for (let a = 0; a < 4; a++) {
    if (!n.arms[a]) continue;
    const ax = DIR_X[a];
    const ay = DIR_Y[a];
    // Arriving traffic comes in along this arm, its lane on the arm's left; drivers look back along -arm.
    const lx = -ay;
    const ly = ax;
    const facing = Math.atan2(ay, ax);
    const travel = ((a + 2) % 4) as Dir;
    const pole = { x: n.x + ax * (STOP_LINE + 0.4) + lx * (ROAD_HALF + 0.55), y: n.y + ay * (STOP_LINE + 0.4) + ly * (ROAD_HALF + 0.55), heading: facing, seed: 0 };
    const head = { x: n.x + ax * (STOP_LINE + 0.4) + lx * LANE_OFFSET, y: n.y + ay * (STOP_LINE + 0.4) + ly * LANE_OFFSET, heading: facing, seed: 0 };
    const near = { x: pole.x - lx * 0.32, y: pole.y - ly * 0.32, heading: facing, seed: 0 };
    out.signals.push({ signal: n.signal, dir: travel, pole, head, near });
  }
  for (const c of city.crosswalks) {
    if (c.node !== n.id) continue;
    const ax = DIR_X[c.arm];
    const ay = DIR_Y[c.arm];
    for (const end of [0, 1]) {
      const ex = end === 0 ? c.ax : c.bx;
      const ey = end === 0 ? c.ay : c.by;
      // Beside the crossing, away from the corner, a step back from the curb; it faces the far side.
      const ix = (c.x - ex) / WALK_LINE;
      const iy = (c.y - ey) / WALK_LINE;
      out.walks.push({ x: ex + ix * 0.9 + ax * 1.9, y: ey + iy * 0.9 + ay * 1.9, heading: Math.atan2(iy, ix), seed: 0, signal: n.signal, axis: c.walkAxis });
    }
  }
}

/**
 * Where all the street furniture goes, from the city's seed: lamps and
 * trees spaced along every sidewalk with a bench or bin here and there,
 * a signal pole with a mast arm at every approach to a signal, and a walk
 * signal at each end of every crossing. Same city, same street.
 */
export function layoutStreetscape(city: City): Streetscape {
  const rng = new Rng(city.spec.seed ^ 0x57ee7);
  const out: Streetscape = { lamps: [], trees: [], benches: [], bins: [], signals: [], walks: [] };
  const nx = city.xs.length;
  for (const n of city.nodes) {
    for (const d of [0, 1] as const) {
      if (!n.arms[d]) continue;
      const b = city.nodes[d === 0 ? n.id + 1 : n.id + nx];
      const len = Math.hypot(b.x - n.x, b.y - n.y);
      along(out, rng, n.x, n.y, DIR_X[d], DIR_Y[d], len, 1);
      along(out, rng, n.x, n.y, DIR_X[d], DIR_Y[d], len, -1);
    }
    junction(out, city, n);
  }
  return out;
}

const cache = new WeakMap<City, Streetscape>();

/** layoutStreetscape, kept per city, so the furniture and the sensor overlay share one layout. */
export function streetscapeFor(city: City): Streetscape {
  let s = cache.get(city);
  if (!s) {
    s = layoutStreetscape(city);
    cache.set(city, s);
  }
  return s;
}
