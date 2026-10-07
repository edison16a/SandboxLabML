/**
 * Where an agent is on a ramp, or in the jump off its lip. Kept on the
 * agent's controls rather than its script view, since scripts only need
 * the summary fields (climbing, airborne, elevation).
 */
export interface ClimbState {
  /** Meters up the slope from the foot while climbing, measured on the floor plane, 0 to the ramp length. */
  progress: number;
  /** Offset from the ramp's center line, m, positive to the left when facing uphill. Kept from where it mounted. */
  lateral: number;
  /** Ticks of the jump played so far, and its whole length in ticks. */
  jumpTick: number;
  jumpTicks: number;
  /** Where the jump leaves the lip and where it lands, on the floor plane, m. */
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  /** The arc: elevation at the lip, at the top, and the share of the jump where the top is. */
  startHeight: number;
  peak: number;
  peakAt: number;
  /** The jump crosses a wall, so landing counts as a vault. */
  vault: boolean;
}

export function createClimbState(): ClimbState {
  return { progress: 0, lateral: 0, jumpTick: 0, jumpTicks: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0, startHeight: 0, peak: 0, peakAt: 0.5, vault: false };
}

/**
 * Elevation `t` of the way through a jump (0 to 1): a smooth rise from the
 * lip height to the peak at `peakAt`, then a smooth fall to the floor.
 * Both halves are flat at the top, so the arc has no kink there, and the
 * peak sits over the tallest thing the jump crosses.
 */
export function jumpElevation(c: ClimbState, t: number): number {
  if (t <= c.peakAt) {
    const u = 1 - t / c.peakAt;
    return c.startHeight + (c.peak - c.startHeight) * (1 - u * u);
  }
  const v = (t - c.peakAt) / (1 - c.peakAt);
  return c.peak * (1 - v * v);
}
