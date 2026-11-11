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

/** The view after `c`, for the key that cycles views. */
export function nextCamera(c: NavCamera): NavCamera {
  return NAV_CAMERAS[(NAV_CAMERAS.indexOf(c) + 1) % NAV_CAMERAS.length];
}

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
}
