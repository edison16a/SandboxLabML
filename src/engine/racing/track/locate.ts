import type { Track } from './types';

/**
 * Finds the nearest centerline sample. With a hint it only searches a small
 * window around the previous answer, which is O(1) per car per tick; cars
 * move at most ~1.2 m per tick so a window of 12 samples is plenty.
 */
export function nearestSample(track: Track, x: number, y: number, hint = -1, window = 12): number {
  const { cx, cy, count } = track;
  let best = -1;
  let bestD = Infinity;
  if (hint < 0) {
    for (let i = 0; i < count; i++) {
      const d = (cx[i] - x) ** 2 + (cy[i] - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
  for (let k = -window; k <= window; k++) {
    const i = (hint + k + count) % count;
    const d = (cx[i] - x) ** 2 + (cy[i] - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export interface TrackPosition {
  index: number;
  /** Distance along the centerline, in [0, length). */
  s: number;
  /** Signed distance from the centerline, positive to the left. */
  lateral: number;
}

/** Projects a point onto the centerline near sample `index`. */
export function project(track: Track, x: number, y: number, index: number, out: TrackPosition): TrackPosition {
  const { cx, cy, tx, ty, length } = track;
  const dx = x - cx[index];
  const dy = y - cy[index];
  const along = dx * tx[index] + dy * ty[index];
  out.index = index;
  out.lateral = -dx * ty[index] + dy * tx[index];
  let s = track.s[index] + along;
  if (s < 0) s += length;
  else if (s >= length) s -= length;
  out.s = s;
  return out;
}
