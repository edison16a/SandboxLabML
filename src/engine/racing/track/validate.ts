import type { Track } from './types';

/** Tightest centerline radius the car model handles at width 8 m. */
export const MIN_RADIUS = 12;

export interface TrackProblems {
  tooTight: boolean;
  selfIntersects: boolean;
  minRadius: number;
}

function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * True if the road edges cross themselves or each other anywhere. Only
 * segments sharing a grid cell are compared, so this stays fast enough to run
 * on every editor drag.
 */
export function edgesSelfIntersect(track: Track): boolean {
  const n = track.count;
  const total = n * 2;
  const seg = (k: number): [number, number, number, number] => {
    const i = k % n;
    const j = (i + 1) % n;
    return k < n
      ? [track.leftX[i], track.leftY[i], track.leftX[j], track.leftY[j]]
      : [track.rightX[i], track.rightY[i], track.rightX[j], track.rightY[j]];
  };
  const cell = 6;
  const buckets = new Map<string, number[]>();
  for (let k = 0; k < total; k++) {
    const [ax, ay, bx, by] = seg(k);
    const c0 = Math.floor(Math.min(ax, bx) / cell);
    const c1 = Math.floor(Math.max(ax, bx) / cell);
    const r0 = Math.floor(Math.min(ay, by) / cell);
    const r1 = Math.floor(Math.max(ay, by) / cell);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = `${c},${r}`;
        const list = buckets.get(key);
        if (list) list.push(k);
        else buckets.set(key, [k]);
      }
    }
  }
  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const ka = list[a];
        const kb = list[b];
        const sameEdge = ka < n === kb < n;
        const gap = Math.abs((ka % n) - (kb % n));
        if (sameEdge && (gap <= 1 || gap >= n - 1)) continue;
        const [ax, ay, bx, by] = seg(ka);
        const [cx, cy, dx, dy] = seg(kb);
        if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return true;
      }
    }
  }
  return false;
}

export function checkTrack(track: Track): TrackProblems {
  let maxK = 0;
  for (let i = 0; i < track.count; i++) maxK = Math.max(maxK, Math.abs(track.curvature[i]));
  const minRadius = maxK > 0 ? 1 / maxK : Infinity;
  return { minRadius, tooTight: minRadius < MIN_RADIUS, selfIntersects: edgesSelfIntersect(track) };
}
