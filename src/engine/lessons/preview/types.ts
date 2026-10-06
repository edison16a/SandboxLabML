import type { HideSeekLayoutId } from '../../hideseek/layouts/types';

/**
 * One lesson test drive, recorded for the preview beside a lesson. Every
 * array is a typed array so a worker can hand it over without copying.
 * Coordinates are track meters with y up.
 */
export interface DrivePreview {
  kind: 'racing';
  /** The road as closed polylines of x, y pairs: the center line and both edges. */
  center: Float32Array;
  left: Float32Array;
  right: Float32Array;
  /** Road width, m. */
  width: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  ticks: number;
  /** x, y and heading of the car after every tick. */
  poses: Float32Array;
  /** Where each ray hit after every tick, as x, y pairs, `rayCount` per tick. */
  rays: Float32Array;
  rayCount: number;
  /** The car's total reward after every tick. */
  rewards: Float32Array;
  /** Why the drive ended: time, crash, or a stop rule's reason. */
  stopReason: string;
}

/** One lesson test match, recorded for the preview. Coordinates are room meters, x right and z toward the viewer. */
export interface MatchPreview {
  kind: 'hideseek';
  layout: HideSeekLayoutId;
  ticks: number;
  /** Ticks of prep at the start, while the seeker is frozen and blind. */
  prepTicks: number;
  /** One arena snapshot per tick, laid out as HIDESEEK_SNAPSHOT says. */
  frames: Float32Array;
  /** Hider and seeker total reward after every tick, in pairs. */
  rewards: Float32Array;
}

export type LessonPreview = DrivePreview | MatchPreview;

export type PreviewResult = { ok: true; preview: LessonPreview } | { ok: false; message: string };

/** The buffers of a preview, for a worker's transfer list. */
export function previewBuffers(p: LessonPreview): ArrayBuffer[] {
  const arrays = p.kind === 'racing' ? [p.center, p.left, p.right, p.poses, p.rays, p.rewards] : [p.frames, p.rewards];
  return arrays.map((a) => a.buffer as ArrayBuffer);
}
