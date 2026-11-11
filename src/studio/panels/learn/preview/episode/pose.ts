import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { frameAt, lerp, lerpAngle } from '../playback';
import type { Bounds } from '../view';

/**
 * Where an env's snapshot keeps the agent's position and facing. Envs that
 * call the ground plane x and y (Driving) draw with y up, like a map;
 * envs that call it x and z (Navigation) draw with z down, like Hide and
 * Seek's rooms. Either way a facing turns the other way on the canvas.
 */
export interface PoseFields {
  x: number;
  y: number;
  /** -1 when the snapshot has no facing. */
  heading: number;
  /** True when the second axis is y, which runs up the screen. */
  flip: boolean;
}

export function poseFields(fields: readonly string[]): PoseFields | null {
  const x = fields.indexOf('x');
  const y = fields.indexOf('y');
  const z = fields.indexOf('z');
  if (x < 0 || (y < 0 && z < 0)) return null;
  const heading = fields.indexOf('heading') >= 0 ? fields.indexOf('heading') : fields.indexOf('yaw');
  return { x, y: y >= 0 ? y : z, heading, flip: y >= 0 };
}

export interface Pose {
  x: number;
  y: number;
  heading: number;
}

/** The agent at recorded tick `k`. */
export function poseAt(p: EpisodePreview, f: PoseFields, k: number): Pose {
  const o = k * p.fields.length;
  return { x: p.frames[o + f.x], y: p.frames[o + f.y], heading: f.heading >= 0 ? p.frames[o + f.heading] : 0 };
}

/** The agent at the playhead, between two recorded ticks. */
export function poseBetween(p: EpisodePreview, f: PoseFields, pos: number): Pose & { i: number } {
  const { i, j, f: t } = frameAt(pos, p.ticks);
  const a = poseAt(p, f, i);
  const b = poseAt(p, f, j);
  return { i, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), heading: lerpAngle(a.heading, b.heading, t) };
}

/** The whole trail's extent, or the env's own bounds when its preview hook gave some. */
export function previewBounds(p: EpisodePreview, f: PoseFields): Bounds {
  if (p.bounds) return p.bounds;
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let k = 0; k < p.ticks; k++) {
    const { x, y } = poseAt(p, f, k);
    b.minX = Math.min(b.minX, x);
    b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y);
    b.maxY = Math.max(b.maxY, y);
  }
  // A short or straight trail still gets a few meters of room around it, and the rays fit at every point.
  const reach = p.rays.reduce((m, r) => Math.max(m, r.maxLength), 0);
  const pad = Math.max(4, reach, 0.15 * Math.max(b.maxX - b.minX, b.maxY - b.minY));
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}
