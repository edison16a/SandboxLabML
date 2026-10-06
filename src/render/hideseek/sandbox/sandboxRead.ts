import type { Rect } from '@/engine/hideseek/layouts/types';
import { boxKindSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { BOX_LOCKED, BOX_PLANK, sandboxAgentAt, sandboxBoxAt, sandboxCounts, sandboxSnapshotLength } from '@/engine/hideseek/sandbox/snapshot';
import { rayAabb, rayBox } from '@/engine/hideseek/sensing/raycast2d';
import type { HsFrame } from '../frame/sceneContext';
import { blendFloorPose, type FloorPose } from '../frame/snapshotRead';

const CUBE = boxKindSize(DEFAULT_HIDESEEK_PHYSICS, 'cube');
const PLANK = boxKindSize(DEFAULT_HIDESEEK_PHYSICS, 'plank');

/**
 * The frame on screen when it is a Sandbox frame: not a still preview, and
 * exactly as long as its header says. Anything else reads as null, so a
 * stray arena frame is never drawn as players.
 */
export function sandboxFrame(frame: HsFrame): Float32Array | null {
  const buf = frame.curr;
  if (!buf || frame.preview || buf.length < 8) return null;
  const c = sandboxCounts(buf);
  return buf.length === sandboxSnapshotLength(c.hiders + c.seekers, c.boxes) ? buf : null;
}

/** The previous frame, when it belongs to the same match (same size), for blending. */
function prevOf(frame: HsFrame, curr: Float32Array): Float32Array | null {
  return frame.prev && frame.prev.length === curr.length ? frame.prev : null;
}

/** Blends player `slot` into `out` and returns its flags. */
export function readPlayer(frame: HsFrame, curr: Float32Array, slot: number, out: FloorPose): number {
  const o = sandboxAgentAt(slot);
  blendFloorPose(prevOf(frame, curr), curr, o, frame.alpha, out);
  return curr[o + 3];
}

/** Blends box `index` into `out` and returns its bits (BOX_LOCKED, BOX_PLANK). */
export function readBox(frame: HsFrame, curr: Float32Array, players: number, index: number, out: FloorPose): number {
  const o = sandboxBoxAt(players, index);
  blendFloorPose(prevOf(frame, curr), curr, o, frame.alpha, out);
  return curr[o + 3];
}

export const isLocked = (bits: number) => (bits & BOX_LOCKED) !== 0;
export const isPlank = (bits: number) => (bits & BOX_PLANK) !== 0;

/**
 * Distance from (x, z) along the unit direction (dx, dz) to the first wall
 * or box of a Sandbox frame, capped at `max`. Like the arena version it
 * agrees with the engine's sight lines and only drives visuals.
 */
export function sandboxSight(walls: Rect[], buf: Float32Array, x: number, z: number, dx: number, dz: number, max: number): number {
  let best = max;
  for (let w = 0; w < walls.length; w++) {
    const r = walls[w];
    const t = rayAabb(x, z, dx, dz, r.x, r.z, r.hx, r.hz);
    if (t < best) best = t;
  }
  const { hiders, seekers, boxes } = sandboxCounts(buf);
  for (let b = 0; b < boxes; b++) {
    const o = sandboxBoxAt(hiders + seekers, b);
    const size = isPlank(buf[o + 3]) ? PLANK : CUBE;
    const yaw = buf[o + 2];
    const t = rayBox(x, z, dx, dz, buf[o], buf[o + 1], size.length / 2, size.width / 2, Math.cos(yaw), Math.sin(yaw));
    if (t < best) best = t;
  }
  return best;
}
