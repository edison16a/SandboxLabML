import type { Course } from '@/engine/navigation/course/build';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';

/** Render tiers, the same four the other labs draw at. Ultra is only reachable from the address, for screenshots. */
export type NavQualityTier = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Camera views. Follow keeps the best agent in frame from behind, looking
 * down the course; Overview shows the whole course at an angle; Top looks
 * straight down; Free only moves when you move it.
 */
export type NavCamera = 'follow' | 'overview' | 'top' | 'free';
export const NAV_CAMERAS: readonly NavCamera[] = ['follow', 'overview', 'top', 'free'];

/**
 * What the viewport draws from: a population stream of one course. The
 * lab fills it from its workers; the preview fills it from a simulation on
 * the main thread. Snapshots follow NAVIGATION_SNAPSHOT and world blocks
 * the layout in engine/navigation/snapshot.ts.
 */
export interface NavFeed {
  /** The course on screen. A new object means a new course: static meshes rebuild. */
  course: Course | null;
  curr: Float32Array | null;
  prev: Float32Array | null;
  world: Float32Array | null;
  prevWorld: Float32Array | null;
  /** Agents in the snapshots. */
  count: number;
  /** Changes whenever a new episode starts, so cameras and trails jump instead of gliding. */
  epoch: number;
  /** Blend from prev to curr, 0 to 1. */
  alpha(): number;
  /** Simulation seconds per wall second: motion and animation run on simulation time. */
  timeScale: number;
  /** The run's input config, for drawing the followed agent's sensors. Null hides them. */
  inputs: NavigationInputConfig | null;
  /** An agent the view must follow (one the user picked), or null to follow the best. */
  follow?: number | null;
  /** A still scene with nobody to follow, such as the lab before it trains: the view shows the whole course. */
  leaderless?: boolean;
  /** Per agent tags: for a ghost replay, the generation each ghost comes from. */
  tags?: Int32Array;
  /**
   * The latest observation of one agent exactly as its brain received it,
   * when the feed streams one. The sensor overlay draws it for the
   * followed agent, so a lesioned or noisy input shows as the brain saw it.
   */
  inspect?: { index: number; obs: ArrayLike<number> } | null;
}
