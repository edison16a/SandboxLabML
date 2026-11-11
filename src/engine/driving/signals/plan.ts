/**
 * The signal plan every intersection runs: east west gets green, then
 * yellow, then a short all red, then north south does the same. Each
 * intersection starts the cycle at its own seeded offset, so lights down a
 * street are not all in step. Left turns go on the same green and must
 * yield to oncoming traffic.
 */
export const GREEN = 15;
export const YELLOW = 3;
export const ALL_RED = 2;
export const SIGNAL_CYCLE = 2 * (GREEN + YELLOW + ALL_RED);
/** People may start crossing for this long after their green starts, then the hand flashes. */
export const WALK = 8;
export const FLASH = 5;

/** Traffic axes. A lane heading east or west is on the east west axis. */
export const AXIS_NS = 0;
export const AXIS_EW = 1;

export const LIGHT_GREEN = 0;
export const LIGHT_YELLOW = 1;
export const LIGHT_RED = 2;
/** Signals switched off (the empty streets level): every head flashes yellow and nobody has to stop. */
export const LIGHT_FLASHING = 3;

export const WALK_DONT = 0;
export const WALK_GO = 1;
export const WALK_FLASHING = 2;

/** Axis of a direction of travel (0 east, 1 north, 2 west, 3 south). */
export function axisOf(dir: number): number {
  return dir % 2 === 0 ? AXIS_EW : AXIS_NS;
}

/** Seconds into the green of `axis` at cycle position u, or negative before it. */
function intoGreen(u: number, axis: number): number {
  const start = axis === AXIS_EW ? 0 : GREEN + YELLOW + ALL_RED;
  return (u - start + SIGNAL_CYCLE) % SIGNAL_CYCLE;
}

function cyclePos(time: number, offset: number): number {
  return (((time + offset) % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
}

/** The light shown to traffic on `axis` at `time` for a signal with this offset. */
export function lightState(time: number, offset: number, axis: number, enabled = true): number {
  if (!enabled) return LIGHT_FLASHING;
  const t = intoGreen(cyclePos(time, offset), axis);
  return t < GREEN ? LIGHT_GREEN : t < GREEN + YELLOW ? LIGHT_YELLOW : LIGHT_RED;
}

/** Seconds until the light on `axis` changes from its current state. */
export function lightRemaining(time: number, offset: number, axis: number): number {
  const t = intoGreen(cyclePos(time, offset), axis);
  if (t < GREEN) return GREEN - t;
  if (t < GREEN + YELLOW) return GREEN + YELLOW - t;
  return SIGNAL_CYCLE - t;
}

/** The walk signal for people crossing with `axis` traffic (see Crosswalk.walkAxis). */
export function walkState(time: number, offset: number, axis: number, enabled = true): number {
  if (!enabled) return WALK_GO;
  const t = intoGreen(cyclePos(time, offset), axis);
  return t < WALK ? WALK_GO : t < WALK + FLASH ? WALK_FLASHING : WALK_DONT;
}
