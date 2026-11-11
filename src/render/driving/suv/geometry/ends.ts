/**
 * Where the body's sections stop at each end, before the end bend. The
 * bend (warp.ts) then pushes the middle of the nose forward to the
 * footprint's front and the tail's bumper back to its rear, so these sit
 * a little inside the 4.9 m box.
 */
export const NOSE = 2.362;
export const TAIL = -2.3;

/**
 * How each end rounds off. Over the last `plan` m the side and the
 * shoulder curl in until they face straight forward (or back): a corner
 * radius in plan view. The fender peak pulls in far less (`peak`, and
 * the valley in proportion), so the hood keeps its width right up to the
 * lamps instead of pinching to a point. Over the last `rollLen` m the
 * top drops by `roll`: a tight radius that gives the hood a crisp front
 * edge and the tail a clean lip.
 */
export const ROUND = {
  nose: { plan: 0.35, peak: 0.16, roll: 0.04, rollLen: 0.04 },
  tail: { plan: 0.25, peak: 0.12, roll: 0.018, rollLen: 0.025 },
};

export interface EndPull {
  /** Pull in of the side keys, sill to shoulder, m. */
  side: number;
  /** Pull in of the fender peak or belt key, m. */
  peak: number;
  /** Drop of the keys from the shoulder up, m. At the nose the shoulder keeps its height and the fender peak takes half. */
  drop: number;
}

/** A quarter circle: 0 at the start of a curl, 1 where it faces straight out of the end. */
function curl(into: number, length: number): number {
  if (into <= 0) return 0;
  const s = Math.min(1, into / length);
  return 1 - Math.sqrt(1 - s * s);
}

/** How far the end rounding pulls the section at x in and down. */
export function endPull(x: number): EndPull {
  const end = x > 0 ? ROUND.nose : ROUND.tail;
  const into = x > 0 ? x - NOSE : TAIL - x;
  const k = curl(into + end.plan, end.plan);
  return { side: end.plan * k, peak: end.peak * k, drop: end.roll * curl(into + end.rollLen, end.rollLen) };
}

/** The station at angle `a` round an end's curl: 0 where the curl starts, PI/2 at the end face. */
export function curlStation(end: 1 | -1, a: number): number {
  const r = end > 0 ? ROUND.nose.plan : ROUND.tail.plan;
  return end > 0 ? NOSE - r * (1 - Math.sin(a)) : TAIL + r * (1 - Math.sin(a));
}
