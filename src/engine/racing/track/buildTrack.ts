import { hashObject } from '../../core/hash';
import { wrapAngle } from '../../core/math';
import { SegmentGrid } from './grid';
import { resampleClosed, sampleClosedSpline } from './spline';
import { CHECKPOINT_SPACING, type Track, type TrackSpec } from './types';

/**
 * Turns control points into the sampled track used everywhere else. This is
 * the single source of truth for geometry: the renderer builds its mesh from
 * these arrays and never recomputes road rules on its own.
 */
export function buildTrack(spec: TrackSpec): Track {
  const dense = sampleClosedSpline(spec.points, 64);
  const roughLength = resampleClosed(dense, dense.length).length;
  const count = Math.max(16, Math.round(roughLength));
  const { points, length } = resampleClosed(dense, count);
  const spacing = length / count;
  const halfWidth = spec.width / 2;

  const cx = new Float64Array(count);
  const cy = new Float64Array(count);
  const tx = new Float64Array(count);
  const ty = new Float64Array(count);
  const heading = new Float64Array(count);
  const curvature = new Float64Array(count);
  const s = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    cx[i] = points[i][0];
    cy[i] = points[i][1];
    s[i] = i * spacing;
  }
  for (let i = 0; i < count; i++) {
    const a = points[(i - 1 + count) % count];
    const b = points[(i + 1) % count];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    tx[i] = (b[0] - a[0]) / len;
    ty[i] = (b[1] - a[1]) / len;
    heading[i] = Math.atan2(ty[i], tx[i]);
  }
  for (let i = 0; i < count; i++) {
    const prev = heading[(i - 1 + count) % count];
    const next = heading[(i + 1) % count];
    curvature[i] = wrapAngle(next - prev) / (2 * spacing);
  }
  smoothInPlace(curvature, 2);

  const leftX = new Float64Array(count);
  const leftY = new Float64Array(count);
  const rightX = new Float64Array(count);
  const rightY = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    // Left normal is the tangent rotated +90 degrees.
    leftX[i] = cx[i] - ty[i] * halfWidth;
    leftY[i] = cy[i] + tx[i] * halfWidth;
    rightX[i] = cx[i] + ty[i] * halfWidth;
    rightY[i] = cy[i] - tx[i] * halfWidth;
  }

  const segments = new Float64Array(count * 2 * 4);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    segments.set([leftX[i], leftY[i], leftX[j], leftY[j]], i * 4);
    segments.set([rightX[i], rightY[i], rightX[j], rightY[j]], (count + i) * 4);
  }

  const perCheckpoint = Math.max(1, Math.round(CHECKPOINT_SPACING / spacing));
  const checkpoints = Int32Array.from({ length: Math.floor(count / perCheckpoint) }, (_, k) => k * perCheckpoint);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, leftX[i], rightX[i]);
    maxX = Math.max(maxX, leftX[i], rightX[i]);
    minY = Math.min(minY, leftY[i], rightY[i]);
    maxY = Math.max(maxY, leftY[i], rightY[i]);
  }

  return {
    spec,
    length,
    count,
    spacing,
    halfWidth,
    cx,
    cy,
    tx,
    ty,
    curvature,
    s,
    leftX,
    leftY,
    rightX,
    rightY,
    checkpoints,
    grid: new SegmentGrid(segments, 8),
    bounds: { minX, minY, maxX, maxY },
    hash: hashObject({ points: spec.points, width: spec.width }),
  };
}

/** Light circular box blur, which removes resampling noise without moving corners. */
function smoothInPlace(values: Float64Array, radius: number): void {
  const n = values.length;
  const copy = Float64Array.from(values);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += copy[(i + k + n) % n];
    values[i] = sum / (2 * radius + 1);
  }
}

/** Signed curvature `ahead` meters down the road from sample i. */
export function curvatureAhead(track: Track, i: number, ahead: number): number {
  const k = Math.round(ahead / track.spacing);
  return track.curvature[(i + k) % track.count];
}

/** Heading of the centerline at sample i. */
export function trackHeading(track: Track, i: number): number {
  return Math.atan2(track.ty[i], track.tx[i]);
}
