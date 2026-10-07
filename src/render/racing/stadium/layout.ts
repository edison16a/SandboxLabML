import { RUNOFF } from '@/engine/racing/car/runtime';
import type { Track } from '@/engine/racing/track/types';
import { distanceAt, type TrackField } from '../world/trackField';

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
  /** Which local z side is outside the loop: grandstands go there, the pits go opposite. */
  side: 1 | -1;
  stands: Placed[];
  pit: Placed | null;
  pads: Pad[];
}

/** Which side of the start line faces away from the circuit's middle. */
export function outsideSign(track: Track): 1 | -1 {
  let mx = 0;
  let my = 0;
  for (let i = 0; i < track.count; i++) {
    mx += track.cx[i];
    my += track.cy[i];
  }
  mx /= track.count;
  my /= track.count;
  // Left of the start tangent, in track coordinates, is local -Z once drawn.
  const left = -track.ty[0] * (mx - track.cx[0]) + track.tx[0] * (my - track.cy[0]);
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

/** True when every point of the pad keeps `clear` meters from the road. */
function fits(field: TrackField, pad: Pad, clear: number): boolean {
  const c = Math.cos(pad.yaw);
  const s = Math.sin(pad.yaw);
  for (let u = -1; u <= 1; u += 0.25) {
    for (let v = -1; v <= 1; v += 0.5) {
      const lx = u * pad.halfLength;
      const lz = v * pad.halfDepth;
      if (distanceAt(field, pad.x + lx * c + lz * s, pad.z - lx * s + lz * c) < clear) return false;
    }
  }
  return true;
}

export function stadiumLayout(track: Track, field: TrackField): StadiumLayout {
  const base = { x: track.cx[0], z: -track.cy[0], yaw: Math.atan2(track.ty[0], track.tx[0]) };
  const side = outsideSign(track);
  const hw = track.halfWidth;
  const clear = hw + RUNOFF + 2.5;
  const stands: Placed[] = [];
  // Two stands either side of the line with a gap for the tunnel, falling back to shorter ones on tight tracks.
  for (const [along, length] of [[-26, 46], [26, 46], [-20, 30], [20, 30]] as const) {
    if (stands.some((p) => Math.sign(p.along) === Math.sign(along))) continue;
    const p: Placed = { along, length, offset: hw + RUNOFF + 5.5, depth: 15 };
    if (fits(field, padOf(base, side, p), clear)) stands.push(p);
  }
  let pit: Placed | null = null;
  for (const length of [64, 44, 30]) {
    const p: Placed = { along: 4, length, offset: hw + RUNOFF + 9, depth: 13 };
    if (fits(field, padOf(base, -side, p), clear)) {
      pit = p;
      break;
    }
  }
  const pads = stands.map((p) => padOf(base, side, p, 7));
  if (pit) pads.push(padOf(base, -side, pit, 7));
  return { ...base, side, stands, pit, pads };
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
