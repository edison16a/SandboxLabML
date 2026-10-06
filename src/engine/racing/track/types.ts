import type { SegmentGrid } from './grid';

export type Vec2 = [number, number];

/** A track as the editor stores it: closed control points and a width. */
export interface TrackSpec {
  id: string;
  name: string;
  points: Vec2[];
  /** Road width in meters. */
  width: number;
}

/**
 * A track as the simulation and renderer use it. Everything is sampled every
 * ~1 m along the centerline, so the renderer draws exactly what cars sense.
 */
export interface Track {
  spec: TrackSpec;
  length: number;
  count: number;
  /** Spacing between samples, length / count. Very close to 1 m. */
  spacing: number;
  halfWidth: number;
  cx: Float64Array;
  cy: Float64Array;
  /** Unit tangent. */
  tx: Float64Array;
  ty: Float64Array;
  /** Signed curvature in 1/m, positive when the road bends left. */
  curvature: Float64Array;
  /** Distance along the centerline at each sample. */
  s: Float64Array;
  leftX: Float64Array;
  leftY: Float64Array;
  rightX: Float64Array;
  rightY: Float64Array;
  /** Sample index of each checkpoint, one every 10 m. */
  checkpoints: Int32Array;
  /** Edge segments for ray casts. */
  grid: SegmentGrid;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Stable hash of the spec, used to key caches and replays. */
  hash: string;
}

export const CHECKPOINT_SPACING = 10;
