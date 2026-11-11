import { hashObject } from '../core/hash';

/**
 * Bump whenever a change could alter a Navigation result (motion, sensors,
 * courses, scoring). It is kept apart from the other games so a change here
 * never blocks their replays, and stored genomes carry it.
 */
export const NAVIGATION_ENGINE_VERSION = 1;

/**
 * Every constant that shapes a Navigation episode. The whole object is
 * hashed onto stored genomes, so a brain trained under one set of rules
 * refuses to replay under another.
 */
export interface NavigationParams {
  /** Seconds per tick. The simulation runs at a fixed 30 Hz. */
  dt: number;
  agent: {
    /** The agent is a circle this wide on the floor, m. */
    radius: number;
    /** Top forward speed, m/s. */
    maxSpeed: number;
    /** Top backward speed as a share of maxSpeed. */
    backShare: number;
    /** Turn rate at full turn output, rad/s. */
    turnRate: number;
    /** How fast the speed follows the move output, m/s². High, so control feels direct, but not instant. */
    accel: number;
  };
  /** A run ends as stuck after this long without getting closer to the finish, s. */
  stuckSeconds: number;
  /** Spikes kill once the agent reaches this far onto their pad, m, so a graze along the trim is forgiven. */
  spikeInset: number;
  /** Crushed once a mover leaves this much overlap that nothing can push out, m. */
  crushDepth: number;
  /**
   * The start grid: the gap between spots in a row and between rows, m, and
   * how far each agent stands off its spot (m) and turns from straight
   * ahead (rad), from its own seed, so the grid looks like people, not pins.
   */
  start: { spacing: number; rowGap: number; jitter: number; jitterYaw: number };
}

export const DEFAULT_NAVIGATION_PARAMS: NavigationParams = {
  dt: 1 / 30,
  agent: { radius: 0.4, maxSpeed: 4, backShare: 0.5, turnRate: 3, accel: 16 },
  stuckSeconds: 4,
  spikeInset: 0.08,
  crushDepth: 0.06,
  start: { spacing: 0.8, rowGap: 0.68, jitter: 0.06, jitterYaw: 0.15 },
};

/** Stable fingerprint of the rules, stored with every genome. */
export function navigationParamsHash(p: NavigationParams = DEFAULT_NAVIGATION_PARAMS): string {
  return hashObject({ env: 'navigation', version: NAVIGATION_ENGINE_VERSION, ...p });
}
