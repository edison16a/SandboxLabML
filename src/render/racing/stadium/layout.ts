import { RUNOFF } from '@/engine/racing/car/runtime';
import type { Track } from '@/engine/racing/track/types';
import { distanceAt, type TrackField } from '../world/trackField';
import { straightAnchor } from './anchor';
import { roofFront } from './grandstandGeometry';
import { PIT_CANOPY, PIT_LANE } from './pitGeometry';

/** A level rectangle in world space: the terrain flattens under it and scenery keeps off it. */
export interface Pad {
  x: number;
  z: number;
  yaw: number;
  halfLength: number;
  halfDepth: number;
}

/** One building along the start straight, in the start line's frame (x along the road, z across). */
export interface Placed {
  along: number;
  length: number;
  /** Distance from the centerline to the building's road side, m. */
  offset: number;
  depth: number;
  /** For the pits: half the pit lane's length, m, trimmed so the lane stays behind the wall. */
  laneHalf?: number;
}

/**
 * Where the circuit's buildings go. Grandstands line the outside of the
 * start straight and the pit building faces them from the infield, the
 * classic main straight. Each piece is only kept if its whole footprint
 * stays clear of every part of the road, so a tight track that doubles
 * back near the line never gets a building on its other leg.
 */
export interface StadiumLayout {
  x: number;
  z: number;
  yaw: number;
  /** Track sample the frame sits on, in the middle of the main straight. */
  index: number;
  /** Which local z side is outside the loop: grandstands go there, the pits go opposite. */
  side: 1 | -1;
  stands: Placed[];
  pit: Placed | null;
  pads: Pad[];
}

/** Which side of the frame at sample `at` faces away from the circuit's middle. */
export function outsideSign(track: Track, at = 0): 1 | -1 {
  let mx = 0;
  let my = 0;
  for (let i = 0; i < track.count; i++) {
    mx += track.cx[i];
    my += track.cy[i];
  }
  mx /= track.count;
  my /= track.count;
  // Left of the start tangent, in track coordinates, is local -Z once drawn.
  const left = -track.ty[at] * (mx - track.cx[at]) + track.tx[at] * (my - track.cy[at]);
  return left > 0 ? 1 : -1;
}

/** Turns a building in the start frame into a world pad, grown by `grow` meters all round. */
export function padOf(l: Pick<StadiumLayout, 'x' | 'z' | 'yaw'>, side: number, p: Placed, grow = 0): Pad {
  const c = Math.cos(l.yaw);
  const s = Math.sin(l.yaw);
  const lz = side * (p.offset + p.depth / 2);
  // Local (x, z) to world: rotation about Y by yaw.
  return { x: l.x + p.along * c + lz * s, z: l.z - p.along * s + lz * c, yaw: l.yaw, halfLength: p.length / 2 + grow, halfDepth: p.depth / 2 + grow };
}

/**
 * True when every point of a rectangle keeps `clear` meters from the road.
 * The rectangle is in a building's own frame: x along the road from the
 * building's middle, z away from the road from its front face, so a roof
 * reaching over the front has a negative `z0`.
 */
function fits(field: TrackField, l: Pick<StadiumLayout, 'x' | 'z' | 'yaw'>, side: number, p: Placed, halfLength: number, z0: number, z1: number, clear: number): boolean {
  const c = Math.cos(l.yaw);
  const s = Math.sin(l.yaw);
  const steps = Math.max(4, Math.ceil(halfLength / 3));
  for (let u = -steps; u <= steps; u++) {
    for (let v = 0; v <= 4; v++) {
      const along = p.along + (u / steps) * halfLength;
      const across = side * (p.offset + z0 + ((z1 - z0) * v) / 4);
      if (distanceAt(field, l.x + along * c + across * s, l.z - along * s + across * c) < clear) return false;
    }
  }
  return true;
}

/**
 * Places the buildings on the main straight. A stand counts with its roof,
 * which reaches toward the road, and the pits with their canopy and the
 * pit lane in front, so nothing ever hangs over the wall or the kerbs.
 */
export function stadiumLayout(track: Track, field: TrackField): StadiumLayout {
  const a = straightAnchor(track);
  const base = { x: a.x, z: a.z, yaw: a.yaw };
  const side = outsideSign(track, a.index);
  const hw = track.halfWidth;
  const clear = hw + RUNOFF + 2.5;
  // The lane may tuck under the back of the wall, but never reach past the wall's foot on the road side.
  const laneClear = hw + RUNOFF + 1.1;
  const roof = roofFront().z;
  // A main straight is rarely ruler straight, so each building may step back a few meters to clear it.
  const PUSH = [0, 1, 2, 3, 4];
  const stands: Placed[] = [];
  // Two stands either side of the middle with a gap for the tunnel, falling back to shorter ones on tight tracks.
  for (const [along, length] of [[-26, 46], [26, 46], [-20, 30], [20, 30]] as const) {
    if (stands.some((p) => Math.sign(p.along) === Math.sign(along))) continue;
    for (const push of PUSH) {
      const p: Placed = { along, length, offset: hw + RUNOFF + 5.5 + push, depth: 15 };
      if (!fits(field, base, side, p, length / 2 + 0.6, Math.min(0, roof), p.depth, clear)) continue;
      stands.push(p);
      break;
    }
  }
  let pit: Placed | null = null;
  for (const length of [64, 44, 30]) {
    for (const push of PUSH) {
      const p: Placed = { along: 4, length, offset: hw + RUNOFF + 9 + push, depth: 13 };
      if (!fits(field, base, -side, p, length / 2 + 0.6, -PIT_CANOPY, p.depth, clear)) continue;
      // The lane runs a few meters past each end of the building where the wall allows, and never less than its length.
      const ext = [5, 3, 1, 0].find((e) => fits(field, base, -side, p, length / 2 + e, -PIT_LANE, 0, laneClear));
      if (ext === undefined) continue;
      pit = { ...p, laneHalf: length / 2 + ext };
      break;
    }
    if (pit) break;
  }
  const pads = stands.map((p) => padOf(base, side, p, 7));
  if (pit) pads.push(padOf(base, -side, pit, 7));
  return { ...base, index: a.index, side, stands, pit, pads };
}

/** How much a pad flattens the ground at (x, z): 1 inside, easing to 0 over `soft` meters outside. */
export function padWeight(p: Pad, x: number, z: number, soft = 14): number {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const dx = x - p.x;
  const dz = z - p.z;
  const lx = Math.abs(dx * c - dz * s) - p.halfLength;
  const lz = Math.abs(dx * s + dz * c) - p.halfDepth;
  const out = Math.hypot(Math.max(0, lx), Math.max(0, lz));
  if (out >= soft) return 0;
  const t = 1 - out / soft;
  return t * t * (3 - 2 * t);
}
