/**
 * Which inputs a Navigation brain gets. Chosen when a run is created and
 * frozen afterwards, because input nodes and innovation numbers depend on
 * it. Each flag adds a fixed group of input nodes. A type, not an
 * interface, so a blueprint can carry it as the generic EpisodeInputs.
 */
export type NavigationInputConfig = {
  rays: {
    count: number;
    /** Total field of view, rad. A full turn spreads rays all round, starting straight ahead. */
    fov: number;
    /** Max ray length, m. */
    range: number;
    /** Adds a "spikes" and a "mover" flag per ray (3 values per ray instead of 1). */
    hitTypes: boolean;
  };
  /** Bearing to the finish and the walking distance left (2 values). */
  goal: boolean;
  /** Bearing to the next step of the shortest path round obstacles (1 value). Makes early levels easy; hard presets turn it off. */
  pathHint: boolean;
  /** Forward and sideways speed (2 values). */
  velocity: boolean;
  /** Share of the episode left (1 value). */
  time: boolean;
  /** Gaussian sensor noise as a fraction of each input's range, 0 to 0.1. */
  noise: number;
};

export const STANDARD_NAVIGATION_INPUTS: NavigationInputConfig = {
  rays: { count: 12, fov: 2 * Math.PI, range: 10, hitTypes: true },
  goal: true,
  pathHint: true,
  velocity: true,
  time: true,
  noise: 0,
};

/** A field of view this close to a full turn counts as all round. */
function allRound(fov: number): boolean {
  return fov >= 2 * Math.PI - 1e-6;
}

/**
 * Ray directions relative to the agent's facing, in input order, left
 * positive. All round: evenly spaced from straight ahead, turning left,
 * with angles past half a turn written as negative (to the right). A
 * narrower fan runs from its left edge to its right edge.
 */
export function navRayAngles(count: number, fov: number): number[] {
  if (count <= 1) return [0];
  if (allRound(fov)) {
    return Array.from({ length: count }, (_, i) => {
      const a = (2 * Math.PI * i) / count;
      return a > Math.PI + 1e-9 ? a - 2 * Math.PI : a;
    });
  }
  return Array.from({ length: count }, (_, i) => fov / 2 - (fov * i) / (count - 1));
}

/** Built in inputs for a config, without script sensors. */
export function navigationInputCount(cfg: NavigationInputConfig): number {
  return cfg.rays.count * (cfg.rays.hitTypes ? 3 : 1) + (cfg.goal ? 2 : 0) + (cfg.pathHint ? 1 : 0) + (cfg.velocity ? 2 : 0) + (cfg.time ? 1 : 0);
}
