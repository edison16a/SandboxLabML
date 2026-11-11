import { createContext, useContext } from 'react';
import type { NavFeed, NavQualityTier } from '../types';
import type { NavFrame } from './navFrame';

/** Settings the viewport's parts read every frame. A plain object the canvas updates in place, so a toggle never remounts the scene. */
export interface NavView {
  tier: NavQualityTier;
  /** Draw the followed agent's sensors. */
  sensors: boolean;
  /** Index of the input the user hovers in a panel, to highlight its ray, or -1. */
  hoveredInput: number;
}

export interface NavSceneValue {
  frame: NavFrame;
  getFeed: () => NavFeed | null;
  /** The ghost replay, when the viewport has one. */
  getGhosts?: () => NavFeed | null;
  view: NavView;
}

export const NavSceneContext = createContext<NavSceneValue | null>(null);

/**
 * Frame callback priorities. The feed driver runs first, then everything
 * that poses agents and movers, before anything that renders the scene on
 * its own (contact shadows at 0), so no pass draws last frame's pose.
 */
export const DRIVER_PRIORITY = -2;
export const POSE_PRIORITY = -0.5;

export function useNavScene(): NavSceneValue {
  const v = useContext(NavSceneContext);
  if (!v) throw new Error('useNavScene must be used inside NavSceneContext');
  return v;
}
