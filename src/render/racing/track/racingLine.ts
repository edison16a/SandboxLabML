import type { Track } from '@/engine/racing/track/types';

/** The worn line drivers take, per centerline sample. */
export interface RacingLine {
  /** Offset from the centerline, m, positive to the left. */
  lateral: Float32Array;
  /** How much rubber is laid there, 0 to 1: most where cars brake and turn hardest. */
  rubber: Float32Array;
}

/**
 * Finds a plausible racing line by relaxing a path toward the straightest
 * one the road allows: every point slides sideways toward the middle of its
 * neighbors, held inside the road. That swings wide into a corner, clips
 * the apex and drifts out again, the classic line, with no knowledge of
 * the car. Purely for the dark rubber on the asphalt; it never drives.
 */
export function racingLine(track: Track, iterations = 260): RacingLine {
  const n = track.count;
  const lat = new Float32Array(n);
  const limit = Math.max(0, track.halfWidth - 1.3);
  const k = Math.max(2, Math.round(9 / track.spacing));
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      const a = (i - k + n) % n;
      const b = (i + k) % n;
      // Neighbors' positions, then the lateral offset at i that puts this point on their chord.
      const ax = track.cx[a] - track.ty[a] * lat[a];
      const ay = track.cy[a] + track.tx[a] * lat[a];
      const bx = track.cx[b] - track.ty[b] * lat[b];
      const by = track.cy[b] + track.tx[b] * lat[b];
      const mx = (ax + bx) / 2 - track.cx[i];
      const my = (ay + by) / 2 - track.cy[i];
      const want = -mx * track.ty[i] + my * track.tx[i];
      lat[i] = Math.max(-limit, Math.min(limit, lat[i] + (want - lat[i]) * 0.5));
    }
  }
  const rubber = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // Average bend over the next 40 m: braking zones before a corner get rubber too.
    let bend = 0;
    for (let j = -10; j <= 40; j += 5) bend = Math.max(bend, Math.abs(track.curvature[(i + j + n) % n]));
    rubber[i] = Math.min(1, 0.35 + bend * 22);
  }
  return { lateral: lat, rubber };
}
