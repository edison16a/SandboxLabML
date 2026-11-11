import type { PreviewBounds } from '../../env/hooks';
import type { EnvId } from '../../env/types';
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

/** A ray of the test agent, as the input schema describes it: its angle from the agent's facing (left positive) and its range, m. */
export interface PreviewRay {
  angle: number;
  maxLength: number;
}

/**
 * One lesson test episode of an env added through the registry, recorded
 * for the preview. The arrays follow the module's own layouts, so the
 * env's Studio drawer reads them the way its renderer reads the streams.
 */
export interface EpisodePreview {
  kind: 'episode';
  env: EnvId;
  tickHz: number;
  ticks: number;
  /** The snapshot field names, so a drawer finds x, y and heading by name. */
  fields: readonly string[];
  /** The test agent's snapshot after every tick, `fields.length` floats each. */
  frames: Float32Array;
  worldFloats: number;
  /** The world block after every tick, `worldFloats` floats each. */
  world: Float32Array;
  /** The agent's rays drawn in the overlay, in the order writeRays writes them. Empty when the env has none. */
  rays: PreviewRay[];
  /** Every ray's reach as a fraction of its range after every tick, `rays.length` floats each. */
  reach: Float32Array;
  /** The agent's total reward after every tick. */
  rewards: Float32Array;
  stopReason: string;
  /** The env's still scene from its preview hook, or null. */
  scene: unknown;
  /** The area to fit, from the preview hook, or null to fit the trail. */
  bounds: PreviewBounds | null;
}

export type LessonPreview = DrivePreview | MatchPreview | EpisodePreview;

export type PreviewResult = { ok: true; preview: LessonPreview } | { ok: false; message: string };

/** The buffers of a preview, for a worker's transfer list. */
export function previewBuffers(p: LessonPreview): ArrayBuffer[] {
  const arrays = p.kind === 'racing' ? [p.center, p.left, p.right, p.poses, p.rays, p.rewards] : p.kind === 'episode' ? [p.frames, p.world, p.reach, p.rewards] : [p.frames, p.rewards];
  return arrays.map((a) => a.buffer as ArrayBuffer);
}
