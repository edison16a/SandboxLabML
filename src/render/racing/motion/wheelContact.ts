import { nearestSample, project, type TrackPosition } from '@/engine/racing/track/locate';
import type { Track } from '@/engine/racing/track/types';
import { WHEEL_SPOTS } from '../car/dimensions';
import { hasKerb, KERB_LAP, KERB_WIDTH, kerbHeight } from '../track/kerbs';
import { cornerWeight } from '../track/roadGeometry';
import type { RoadInput } from './bodyModel';

/** What each tire is touching. */
export const SURFACE = { asphalt: 0, kerb: 1, gravel: 2, grass: 3 } as const;

/** Per wheel contact for one car, in WHEEL_SPOTS order (front right, front left, rear right, rear left). */
export interface WheelContact {
  /** How far the road lifts each wheel, m: kerb height plus the buzz of its ridges. */
  lift: Float32Array;
  surface: Uint8Array;
  /** Last nearest sample per wheel, so the next search only looks nearby. */
  hint: Int32Array;
  /** World position of each contact patch, x and z. */
  at: Float32Array;
  road: RoadInput;
  /** The car's own distance along the road, m, and the sample it was found near. */
  s: number;
  centerHint: number;
  /** Where the car stood last frame (sim coordinates), to spot a jump. */
  lastX: number;
  lastY: number;
}

export function wheelContact(): WheelContact {
  return { lift: new Float32Array(4), surface: new Uint8Array(4), hint: new Int32Array(4).fill(-1), at: new Float32Array(8), road: { lift: 0, side: 0, front: 0 }, s: 0, centerHint: -1, lastX: 0, lastY: 0 };
}

/** Forgets every search hint, for when the followed car changes or jumps. */
export function resetContact(c: WheelContact): void {
  c.hint.fill(-1);
  c.centerHint = -1;
}

const pos: TrackPosition = { index: 0, s: 0, lateral: 0 };
/** Samples a hinted search looks either way, the engine's own default. */
const WINDOW = 12;
/** A car further than this from its last spot, m, jumped (a restart, a new car, Turbo or a slow frame). */
const JUMP = 10;

/**
 * Nearest sample to (x, y) and the projection onto it. The hinted search
 * only looks 12 m either way, so when its answer lands on the window's edge
 * or far off the road, the car has moved further than that and the whole
 * track is searched instead. Without this a stale hint reads a car in the
 * middle of the lane as off the road for many frames.
 */
export function locate(track: Track, x: number, y: number, hint: number, out: TrackPosition): number {
  let idx = nearestSample(track, x, y, hint, WINDOW);
  project(track, x, y, idx, out);
  if (hint < 0) return idx;
  const n = track.count;
  let d = (((idx - hint) % n) + n) % n;
  if (d > n / 2) d -= n;
  if (Math.abs(d) >= WINDOW || Math.abs(out.lateral) > track.halfWidth + JUMP) {
    idx = nearestSample(track, x, y, -1);
    project(track, x, y, idx, out);
  }
  return idx;
}

/**
 * Finds what is under each of a car's four tires from its simulated pose
 * (sim coordinates, heading in radians): asphalt, the raised kerb, or the
 * gravel and grass beyond. Kerbs lift the wheel by their real profile and
 * buzz it with their ridges, so the car shakes as it clips an apex.
 */
export function readContact(track: Track, x: number, y: number, heading: number, out: WheelContact): WheelContact {
  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  const hw = track.halfWidth;
  if ((x - out.lastX) ** 2 + (y - out.lastY) ** 2 > JUMP * JUMP) resetContact(out);
  out.lastX = x;
  out.lastY = y;
  out.centerHint = locate(track, x, y, out.centerHint, pos);
  out.s = pos.s;
  for (let w = 0; w < 4; w++) {
    const [lx, lz] = WHEEL_SPOTS[w];
    // Local +z is the car's right, which is minus its left normal (-fy, fx).
    const wx = x + fx * lx + fy * lz;
    const wy = y + fy * lx - fx * lz;
    const idx = locate(track, wx, wy, out.hint[w], pos);
    out.hint[w] = idx;
    const across = Math.abs(pos.lateral) - hw;
    let lift = 0;
    let surface: number = SURFACE.asphalt;
    if (across > -KERB_LAP && hasKerb(track, idx) && across < KERB_WIDTH) {
      surface = SURFACE.kerb;
      // Ridges every 30 cm along the kerb; the faster the car, the faster they buzz.
      lift = kerbHeight(across) + 0.005 * Math.sin((pos.s / 0.3) * Math.PI * 2);
    } else if (across > 0) {
      surface = cornerWeight(track, idx) > 0.4 ? SURFACE.gravel : SURFACE.grass;
      lift = 0.006 * Math.sin(pos.s * 9.1) * Math.sin(pos.s * 3.7);
    }
    out.lift[w] = lift;
    out.surface[w] = surface;
    out.at[w * 2] = wx;
    out.at[w * 2 + 1] = -wy;
  }
  const l = out.lift;
  out.road.lift = (l[0] + l[1] + l[2] + l[3]) / 4;
  out.road.side = (l[1] + l[3] - l[0] - l[2]) / 2;
  out.road.front = (l[0] + l[1] - l[2] - l[3]) / 2;
  return out;
}
