/** Ticks per second of both simulations, so playing 30 ticks a second is real time. */
export const TICKS_PER_SECOND = 30;
/** How long the last frame stays up before the replay starts over, s. */
export const HOLD_SECONDS = 1.5;
/**
 * Longest step the playhead takes in one animation frame, ms. After a
 * stall (a busy main thread, a tab coming back) the replay carries on
 * where it was instead of jumping ahead.
 */
export const MAX_STEP_MS = 100;

/**
 * Moves the playhead, in ticks, on by `ms` of wall time. Past the last
 * tick it holds the final frame for a moment, then starts over, so a
 * learner can see how the episode ended before it loops.
 */
export function advance(pos: number, ms: number, ticks: number): number {
  const next = pos + (Math.min(ms, MAX_STEP_MS) / 1000) * TICKS_PER_SECOND;
  return next >= ticks - 1 + HOLD_SECONDS * TICKS_PER_SECOND ? 0 : next;
}

/** The two recorded frames either side of the playhead and how far between them it is, 0 to 1. Holds on the last frame. */
export function frameAt(pos: number, ticks: number): { i: number; j: number; f: number } {
  if (ticks <= 1) return { i: 0, j: 0, f: 0 };
  const p = Math.min(Math.max(pos, 0), ticks - 1);
  const i = Math.floor(p);
  return { i, j: Math.min(i + 1, ticks - 1), f: p - i };
}

/** Seconds into the episode at the playhead. Frame 0 is the state after the first tick. */
export function secondsAt(pos: number, ticks: number): number {
  return (Math.min(Math.max(pos, 0), Math.max(0, ticks - 1)) + 1) / TICKS_PER_SECOND;
}

export const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** Interpolates angles the short way round, so a heading that wraps past pi does not spin the car. */
export function lerpAngle(a: number, b: number, f: number): number {
  const turn = 2 * Math.PI;
  const d = b - a - turn * Math.round((b - a) / turn);
  return a + d * f;
}
