import { RUNOFF } from '@/engine/racing/car/runtime';
import type { Track } from '@/engine/racing/track/types';
import { cornerWeight } from '../track/roadGeometry';
import { distanceAt, insideAt, type TrackField } from '../world/trackField';
import { BOWL_DEPTH, roofBack } from './grandstandGeometry';
import { padWeight, type StadiumLayout } from './layout';
import { PIT_TOP } from './pitGeometry';

/** A thing standing by the circuit: world position, yaw and, for boards, which way it faces. */
export interface Spot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** For boards: 1 when the road is on the board's -z side. */
  side: number;
  kind: number;
}

/** Local (along, across, up) in the start frame to a world spot. */
function fromStart(l: StadiumLayout, along: number, across: number, y: number, kind = 0): Spot {
  const c = Math.cos(l.yaw);
  const s = Math.sin(l.yaw);
  return { x: l.x + along * c + across * s, y, z: l.z - along * s + across * c, yaw: l.yaw, side: Math.sign(across) || 1, kind };
}

/**
 * Trackside boards along the straights, outside the loop, about every
 * 80 m, each kept clear of every part of the road and of the buildings.
 */
export function billboardSpots(track: Track, field: TrackField, layout: StadiumLayout): Spot[] {
  const out: Spot[] = [];
  const offset = track.halfWidth + RUNOFF + 5;
  const clear = track.halfWidth + RUNOFF + 2.8;
  const step = Math.max(1, Math.round(80 / track.spacing));
  for (let i = Math.round(40 / track.spacing); i < track.count; i += step) {
    if (cornerWeight(track, i, 15) > 0.15) continue;
    for (const lat of [offset, -offset]) {
      const x = track.cx[i] - track.ty[i] * lat;
      const z = -(track.cy[i] + track.tx[i] * lat);
      if (insideAt(field, x, z)) continue;
      const tx = track.tx[i];
      const tz = -track.ty[i];
      const ok = [-5, 0, 5].every((a) => distanceAt(field, x + tx * a, z + tz * a) > clear) && layout.pads.every((p) => padWeight(p, x, z, 6) === 0);
      // Local +z of the start frame convention is the road's right, so a board on the left has the road on its +z side.
      if (ok) out.push({ x, y: 0, z, yaw: Math.atan2(track.ty[i], track.tx[i]), side: lat > 0 ? -1 : 1, kind: out.length % 3 });
    }
  }
  return out;
}

/** Floodlight towers at the corners of the stands and the pit building. */
export function towerSpots(layout: StadiumLayout): Spot[] {
  const out: Spot[] = [];
  if (layout.stands.length) {
    const ends = layout.stands.map((s) => [s.along - s.length / 2 - 3, s.along + s.length / 2 + 3]).flat();
    const off = layout.stands[0].offset + BOWL_DEPTH + 3;
    out.push(fromStart(layout, Math.min(...ends), layout.side * off, 0), fromStart(layout, Math.max(...ends), layout.side * off, 0));
  }
  if (layout.pit) {
    const p = layout.pit;
    for (const a of [p.along - p.length / 2 - 4, p.along + p.length / 2 + 4]) out.push(fromStart(layout, a, -layout.side * (p.offset + p.depth + 2), 0));
  }
  return out;
}

/** Flag poles along the back of every stand roof and on the pit roof. */
export function flagSpots(layout: StadiumLayout): Spot[] {
  const out: Spot[] = [];
  const back = roofBack();
  for (const s of layout.stands) {
    const n = Math.max(2, Math.round(s.length / 8));
    for (let k = 0; k <= n; k++) out.push(fromStart(layout, s.along - s.length / 2 + (k * s.length) / n, layout.side * (s.offset + back.z), back.y, k));
  }
  if (layout.pit) {
    const p = layout.pit;
    for (let k = 0; k < 4; k++) out.push(fromStart(layout, p.along - p.length * 0.35 + (k * p.length * 0.7) / 3, -layout.side * (p.offset + p.depth - 1), PIT_TOP + 0.45, k + 1));
  }
  return out;
}
