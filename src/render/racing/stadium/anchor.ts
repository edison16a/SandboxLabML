import type { Track } from '@/engine/racing/track/types';

/** Where the stadium frame sits: a sample on the main straight, its world position and the straight's heading. */
export interface Anchor {
  index: number;
  x: number;
  z: number;
  yaw: number;
}

/** Length of straight the buildings need, and how far from the line to look for it, m. */
const WINDOW = 120;
const REACH = 150;
/** Turning (rad) a window may trade for each meter it sits further from the line. */
const DRIFT = 0.002;

/**
 * Finds the main straight: the 120 m stretch within 150 m of the start
 * line that turns the least, with a small bias toward the line. Sample 0
 * is where the editor closed the loop, which on every built in track is a
 * corner, so buildings lined up on it would sit at an angle to the road
 * they face. The frame takes the stretch's middle and its mean heading.
 */
export function straightAnchor(track: Track): Anchor {
  const n = track.count;
  const half = Math.max(1, Math.round(WINDOW / 2 / track.spacing));
  const reach = Math.min(Math.round(REACH / track.spacing), Math.floor(n / 2) - half);
  const wrap = (i: number) => ((i % n) + n) % n;
  let best = 0;
  let bestCost = Infinity;
  for (let c = -reach; c <= reach; c++) {
    let turn = 0;
    for (let k = -half; k <= half; k++) turn += Math.abs(track.curvature[wrap(c + k)]) * track.spacing;
    const cost = turn + Math.abs(c * track.spacing) * DRIFT;
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  }
  const index = wrap(best);
  let tx = 0;
  let ty = 0;
  for (let k = -half; k <= half; k++) {
    tx += track.tx[wrap(best + k)];
    ty += track.ty[wrap(best + k)];
  }
  return { index, x: track.cx[index], z: -track.cy[index], yaw: Math.atan2(ty, tx) };
}
