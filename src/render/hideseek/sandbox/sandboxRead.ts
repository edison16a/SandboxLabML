import { boxSlice, DEFAULT_HIDESEEK_PHYSICS, type BoxKind, type BoxSlice } from '@/engine/hideseek/physics';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { distanceToBox } from '@/engine/hideseek/layouts/geometry';
import { AGENT_ELEVATION, AGENT_FLAGS, BOX_YAW, BOX_X, BOX_Z, FLAG_CLIMBING, FLAG_FROZEN } from '@/engine/hideseek/snapshot';
import { SANDBOX_LIMITS } from '@/engine/hideseek/sandbox/room';
import {
  BOX_LOCKED,
  SANDBOX_BOX_BITS,
  SANDBOX_PHASE,
  sandboxAgentAt,
  sandboxBoxAt,
  sandboxBoxCount,
  sandboxBoxKind,
  sandboxHiderCount,
  sandboxSeekerCount,
  sandboxSnapshotLength,
} from '@/engine/hideseek/sandbox/snapshot';
import { rayAabb, rayBox } from '@/engine/hideseek/sensing/raycast2d';
import type { HsFrame } from '../frame/sceneContext';
import { blendAgentPose, blendFloorPose, type AgentPose, type FloorPose } from '../frame/snapshotRead';

export { sandboxBoxKind, sandboxBoxLock } from '@/engine/hideseek/sandbox/snapshot';

const P = DEFAULT_HIDESEEK_PHYSICS;
/** The sight slice of each kind, the part of a box that stands taller than sight height. */
const SLICES: Record<BoxKind, BoxSlice> = { cube: boxSlice(P, 'cube'), plank: boxSlice(P, 'plank'), ramp: boxSlice(P, 'ramp') };

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

/** Blends player `slot`, elevation included, into `out` and returns its flags. */
export function readPlayer(frame: HsFrame, curr: Float32Array, slot: number, out: AgentPose): number {
  const o = sandboxAgentAt(slot);
  blendAgentPose(prevOf(frame, curr), curr, o, frame.alpha, out);
  return curr[o + AGENT_FLAGS];
}

/** Elevation of player `slot` above the floor, m. */
export const playerElevation = (curr: Float32Array, slot: number): number => curr[sandboxAgentAt(slot) + AGENT_ELEVATION];

/** Bits (see the engine's boxBits.ts) of box `index` in a frame with `players` players. */
export const boxBits = (curr: Float32Array, players: number, index: number): number => curr[sandboxBoxAt(players, index) + SANDBOX_BOX_BITS];

/** Blends box `index` into `out` and returns its bits. */
export function readBox(frame: HsFrame, curr: Float32Array, players: number, index: number, out: FloorPose): number {
  blendFloorPose(prevOf(frame, curr), curr, sandboxBoxAt(players, index), frame.alpha, out);
  return boxBits(curr, players, index);
}

export const isLocked = (bits: number) => (bits & BOX_LOCKED) !== 0;

/**
 * Whether a seeker is blind and still: frozen by the engine, or in prep.
 * The frame before the first tick has no frozen flags yet, but its phase
 * already says prep, so seekers never show a cone before the seek starts.
 */
export function seekerIdle(curr: Float32Array, flags: number): boolean {
  return (flags & FLAG_FROZEN) !== 0 || curr[SANDBOX_PHASE] === 1;
}

/** Floats per box in SightBoxes: slice center x and z, half length, half width, cos and sin of the yaw, box center x and z, 1 for a ramp. */
const SIGHT_STRIDE = 9;
const RAMP = P.box.ramp;

/**
 * The boxes of one frame shaped for sight tests: the sight slice of each
 * (a ramp only blocks sight where it is taller than sight height). Sizes
 * and the cos and sin of each yaw are worked out once a frame here,
 * instead of once per ray, and the array is reused, so casting cones
 * allocates nothing.
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
      const kind = sandboxBoxKind(boxBits(buf, players, b));
      const slice = SLICES[kind];
      const yaw = buf[o + BOX_YAW];
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const d = b * SIGHT_STRIDE;
      this.data[d] = buf[o + BOX_X] + slice.offset * cos;
      this.data[d + 1] = buf[o + BOX_Z] - slice.offset * sin;
      this.data[d + 2] = slice.hx;
      this.data[d + 3] = slice.hz;
      this.data[d + 4] = cos;
      this.data[d + 5] = sin;
      this.data[d + 6] = buf[o + BOX_X];
      this.data[d + 7] = buf[o + BOX_Z];
      this.data[d + 8] = kind === 'ramp' ? 1 : 0;
    }
    this.count = n;
  }

  /**
   * Distance along the ray to the nearest box, or `max` when none is
   * closer. From a `climbing` viewer the ray passes through the ramp under
   * it, as the engine's sight does for the ramp a climber stands on.
   */
  hit(x: number, z: number, dx: number, dz: number, max: number, climbing = false): number {
    let best = max;
    const v = this.data;
    for (let d = 0; d < this.count * SIGHT_STRIDE; d += SIGHT_STRIDE) {
      if (climbing && v[d + 8] === 1 && distanceToBox(x, z, v[d + 6], v[d + 7], RAMP.length / 2, RAMP.width / 2, Math.atan2(v[d + 5], v[d + 4])) <= P.agent.radius) continue;
      const t = rayBox(x, z, dx, dz, v[d], v[d + 1], v[d + 2], v[d + 3], v[d + 4], v[d + 5]);
      if (t < best) best = t;
    }
    return best;
  }
}

/**
 * Distance from (x, z) along the unit direction (dx, dz) to the first wall
 * or box, capped at `max`. Like the arena version it agrees with the
 * engine's sight lines and only drives visuals. `flags` and `elevation`
 * are the viewer's: high enough on a ramp it sees over boxes, never over
 * walls, and its sight passes through the ramp it climbs. `boxes` must
 * have read the frame on screen.
 */
export function sandboxSight(walls: Rect[], boxes: SightBoxes, x: number, z: number, dx: number, dz: number, max: number, flags = 0, elevation = 0): number {
  let best = max;
  for (let w = 0; w < walls.length; w++) {
    const r = walls[w];
    const t = rayAabb(x, z, dx, dz, r.x, r.z, r.hx, r.hz);
    if (t < best) best = t;
  }
  return elevation >= P.climb.seeOverBoxes ? best : boxes.hit(x, z, dx, dz, best, (flags & FLAG_CLIMBING) !== 0);
}
