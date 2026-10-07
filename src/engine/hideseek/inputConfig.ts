/**
 * Which inputs a Hide and Seek brain gets. Each flag adds a fixed group of
 * input nodes, so turning a group off makes the starting network smaller.
 */
export interface HideSeekInputConfig {
  rays: {
    count: number;
    /** Max ray length, m. */
    range: number;
    /** Adds "hit a box" and "hit an agent" flags per ray (3 values per ray instead of 1). */
    hitTypes: boolean;
  };
  /** Forward speed only (1 value). Ignored when `velocity` is on. */
  speed: boolean;
  /** Forward and sideways velocity (2 values). */
  velocity: boolean;
  /** Whether the agent is holding a box (1 value). */
  holding: boolean;
  /** Prep phase flag (1 value). */
  phase: boolean;
  /** Fraction of the match left (1 value). */
  time: boolean;
  /** Opponent currently in sight (1 value). */
  opponentVisible: boolean;
  /** Bearing to where the opponent was last seen (1 value). */
  opponentLastSeen: boolean;
  /** Relative x, z, distance and locked flag of the nearest cubes and planks (4 values each). */
  nearestBoxes: number;
  /**
   * The nearest ramp: ahead and to the right in the agent frame and its
   * distance, how squarely the agent faces uphill on it, its lock seen
   * from this agent (own team +1, other team -1, free 0), and the agent's
   * own elevation as a share of the ramp height (6 values).
   */
  ramp: boolean;
  /** Gaussian sensor noise as a fraction of each input's range, 0 to 0.1. */
  noise: number;
}

export const STANDARD_HIDESEEK_INPUTS: HideSeekInputConfig = {
  rays: { count: 16, range: 12, hitTypes: true },
  speed: false,
  velocity: true,
  holding: true,
  phase: true,
  time: true,
  opponentVisible: true,
  opponentLastSeen: true,
  nearestBoxes: 0,
  ramp: true,
  noise: 0,
};

/**
 * An input config read back from storage, made whole. Blueprints, runs
 * and checkpoints saved before ramps have no `ramp` field, and their
 * brains were shaped without those inputs, so a missing field means off.
 */
export function normalizeHideSeekInputs(c: HideSeekInputConfig): HideSeekInputConfig {
  return c.ramp === undefined ? { ...c, ramp: false } : c;
}

/** Outputs: move forward or back, turn, grab (when > 0), lock (when > 0). */
export const HIDESEEK_OUTPUT_COUNT = 4;

export function hideSeekInputCount(c: HideSeekInputConfig): number {
  return (
    c.rays.count * (c.rays.hitTypes ? 3 : 1) +
    (c.velocity ? 2 : c.speed ? 1 : 0) +
    (c.holding ? 1 : 0) +
    (c.phase ? 1 : 0) +
    (c.time ? 1 : 0) +
    (c.opponentVisible ? 1 : 0) +
    (c.opponentLastSeen ? 1 : 0) +
    c.nearestBoxes * 4 +
    (c.ramp ? 6 : 0)
  );
}
