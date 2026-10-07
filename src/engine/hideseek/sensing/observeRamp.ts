import { localAhead, localLeft } from '../frame';
import type { PlayState } from '../match/state';

/**
 * The ramp group of agent `i`'s inputs (see HideSeekInputConfig.ramp),
 * written into `out` from `n`; returns the next free slot. The ramp is the
 * one the agent climbs, else the nearest by center, ties to the lower
 * index. Its offset and distance are over the room size, like the box
 * inputs. With no ramp in the room it reads as far away and free.
 */
export function writeRamp(s: PlayState, i: number, out: Float64Array, n: number): number {
  const a = s.agents[i];
  const p = s.physics;
  const size = p.arena.size;
  let best = a.climbRamp;
  let bestD = Infinity;
  for (let b = 0; best < 0 && b < s.boxes.length; b++) {
    const box = s.boxes[b];
    if (box.kind !== 'ramp') continue;
    const dx = box.x - a.x;
    const dz = box.z - a.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  if (best < 0) {
    out[n++] = 0;
    out[n++] = 0;
    out[n++] = 1;
    out[n++] = 0;
    out[n++] = 0;
    out[n++] = a.elevation / p.box.ramp.height;
    return n;
  }
  const r = s.boxes[best];
  const dx = r.x - a.x;
  const dz = r.z - a.z;
  out[n++] = localAhead(dx, dz, a.yaw) / size;
  out[n++] = -localLeft(dx, dz, a.yaw) / size;
  out[n++] = Math.sqrt(dx * dx + dz * dz) / size;
  out[n++] = Math.cos(a.yaw - r.yaw);
  out[n++] = r.lockedBy < 0 ? 0 : r.lockedBy === a.index ? 1 : -1;
  out[n++] = a.elevation / p.box.ramp.height;
  return n;
}
