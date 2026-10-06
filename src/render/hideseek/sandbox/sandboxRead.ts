import type { Rect } from '@/engine/hideseek/layouts/types';
import { boxKindSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { FLAG_FROZEN } from '@/engine/hideseek/snapshot';
import { SANDBOX_LIMITS } from '@/engine/hideseek/sandbox/room';
import {
  BOX_LOCKED,
  BOX_PLANK,
  sandboxAgentAt,
  sandboxBoxAt,
  sandboxBoxCount,
  sandboxHiderCount,
  sandboxSeekerCount,
  sandboxSnapshotLength,
} from '@/engine/hideseek/sandbox/snapshot';
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
  return buf.length === sandboxSnapshotLength(sandboxPlayerCount(buf), sandboxBoxCount(buf)) ? buf : null;
}

/** Hiders and seekers in a frame. */
export const sandboxPlayerCount = (buf: Float32Array): number => sandboxHiderCount(buf) + sandboxSeekerCount(buf);

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
 * Whether a seeker is blind and still: frozen by the engine, or in prep.
 * The frame before the first tick has no frozen flags yet, but its phase
 * already says prep, so seekers never show a cone before the seek starts.
 */
export function seekerIdle(curr: Float32Array, flags: number): boolean {
  return (flags & FLAG_FROZEN) !== 0 || curr[1] === 1;
}

/** Floats per box in SightBoxes: center x and z, half length, half width, cos and sin of the yaw. */
const SIGHT_STRIDE = 6;

/**
 * The boxes of one frame shaped for sight tests. Their sizes and the cos
 * and sin of their yaws are worked out once a frame here, instead of once
 * per ray, and the array is reused, so casting cones allocates nothing.
 */
export class SightBoxes {
  private data = new Float32Array(SANDBOX_LIMITS.boxes * SIGHT_STRIDE);
  private count = 0;

  /** Reads the boxes of a Sandbox frame. Call it once a frame, before any ray. */
  read(buf: Float32Array): void {
    const players = sandboxPlayerCount(buf);
    const n = sandboxBoxCount(buf);
    if (n * SIGHT_STRIDE > this.data.length) this.data = new Float32Array(n * SIGHT_STRIDE);
    for (let b = 0; b < n; b++) {
      const o = sandboxBoxAt(players, b);
      const size = isPlank(buf[o + 3]) ? PLANK : CUBE;
      const d = b * SIGHT_STRIDE;
      this.data[d] = buf[o];
      this.data[d + 1] = buf[o + 1];
      this.data[d + 2] = size.length / 2;
      this.data[d + 3] = size.width / 2;
      this.data[d + 4] = Math.cos(buf[o + 2]);
      this.data[d + 5] = Math.sin(buf[o + 2]);
    }
    this.count = n;
  }

  /** Distance along the ray to the nearest box, or `max` when none is closer. */
  hit(x: number, z: number, dx: number, dz: number, max: number): number {
    let best = max;
    const v = this.data;
    for (let d = 0; d < this.count * SIGHT_STRIDE; d += SIGHT_STRIDE) {
      const t = rayBox(x, z, dx, dz, v[d], v[d + 1], v[d + 2], v[d + 3], v[d + 4], v[d + 5]);
      if (t < best) best = t;
    }
    return best;
  }
}

/**
 * Distance from (x, z) along the unit direction (dx, dz) to the first wall
 * or box, capped at `max`. Like the arena version it agrees with the
 * engine's sight lines and only drives visuals. `boxes` must have read the
 * frame on screen.
 */
export function sandboxSight(walls: Rect[], boxes: SightBoxes, x: number, z: number, dx: number, dz: number, max: number): number {
  let best = max;
  for (let w = 0; w < walls.length; w++) {
    const r = walls[w];
    const t = rayAabb(x, z, dx, dz, r.x, r.z, r.hx, r.hz);
    if (t < best) best = t;
  }
  return boxes.hit(x, z, dx, dz, best);
}
