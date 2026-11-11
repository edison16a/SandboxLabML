import { ELEMENT_LANE } from '../city/types';
import { axisOf, LIGHT_RED, lightState } from '../signals/plan';
import type { Fleet } from './fleet';
import type { TrafficContext } from './rules';

/** People wait while a car that may cross is this close to the crossing, m. */
const APPROACH = 30;

/**
 * Marks every zebra crossing a car is about to drive over, so people
 * waiting there hold back until it has passed. A crossing is threatened by
 * a car on a turn over it whose rear has not yet cleared it, and by a car on
 * the lane before such a turn, within APPROACH meters and free to go (its
 * light is not red). Cars held at a red light are no threat, unless one
 * stopped late with its nose on the crossing.
 */
export function markThreats(f: Fleet, ctx: TrafficContext, out: Uint8Array): void {
  out.fill(0);
  const elements = f.city.elements;
  for (let i = 0; i < f.count; i++) {
    const e = elements[f.el[i]];
    const half = f.len[i] / 2;
    if (e.kind === ELEMENT_LANE) {
      const turn = elements[f.nxt[i]];
      if (turn.crossings.length === 0) continue;
      const front = e.path.length - f.s[i] - half;
      if (front > APPROACH) continue;
      const free = !e.stopLine || lightState(ctx.time, ctx.signalOffsets[f.city.nodes[e.to].signal], axisOf(e.dir), ctx.signalsOn) !== LIGHT_RED;
      for (let k = 0; k < turn.crossings.length; k++) {
        const d = front + turn.crossings[k].s0;
        // A car that stopped late with its nose over the crossing blocks it whatever its light says.
        if (d < 0.5 || (free && d < APPROACH)) out[turn.crossings[k].crosswalk] = 1;
      }
    } else {
      for (let k = 0; k < e.crossings.length; k++) {
        const c = e.crossings[k];
        if (f.s[i] - half < c.s1 + 0.5) out[c.crosswalk] = 1;
      }
    }
  }
}
