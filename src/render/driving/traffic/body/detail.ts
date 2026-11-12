/**
 * How finely a traffic car is built on each tier. Every tier draws the
 * same design; lower tiers use fewer stations along the body, fewer points
 * round each section and coarser decals, and drop the finest decals.
 */
export interface TrafficDetail {
  /** Stations through each end's rounding. */
  ends: number;
  /** Largest gap between stations along the straight middle, m. */
  spacing: number;
  /** Stations across each wheel opening. */
  arch: number;
  /** Segments on the lower trim, the two spans of the lower side and the four spans from the shoulder to the centerline. */
  p0: number;
  p1: readonly [number, number];
  p2: readonly [number, number, number, number];
  /** Share of each decal's High grid this tier keeps. */
  cells: number;
  /** Dark surrounds, pillars, shut lines and other fine decals. */
  fine: boolean;
  /** Segments round a wheel. */
  wheel: number;
}

export type DetailName = 'high' | 'medium' | 'low';

export const TRAFFIC_DETAIL: Record<DetailName, TrafficDetail> = {
  high: { ends: 7, spacing: 0.34, arch: 7, p0: 1, p1: [1, 2], p2: [2, 2, 2, 2], cells: 1, fine: true, wheel: 20 },
  medium: { ends: 6, spacing: 0.4, arch: 6, p0: 1, p1: [1, 2], p2: [2, 1, 2, 2], cells: 0.75, fine: true, wheel: 16 },
  low: { ends: 4, spacing: 0.55, arch: 5, p0: 1, p1: [1, 1], p2: [1, 1, 1, 2], cells: 0.5, fine: false, wheel: 12 },
};
