import type { PreviewBounds } from '../../env/hooks';
import type { EnvId } from '../../env/types';

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

export type LessonPreview = EpisodePreview;

export type PreviewResult = { ok: true; preview: LessonPreview } | { ok: false; message: string };

/** The buffers of a preview, for a worker's transfer list. */
export function previewBuffers(p: LessonPreview): ArrayBuffer[] {
  return [p.frames, p.world, p.reach, p.rewards].map((a) => a.buffer as ArrayBuffer);
}
