import type { HeroFeed } from './heroFeed';

/** The quality tiers the hero draws at. Ultra is for lab screenshots only. */
export type HeroTier = 'low' | 'medium' | 'high';

/** What both hero scenes take from the page. */
export interface HeroSceneProps<F extends HeroFeed> {
  feed: F;
  tier: HeroTier;
  /** False while the hero is off screen or the tab hidden: the canvas then keeps its last frame and nothing moves. */
  running: boolean;
  /** Called once the scene has compiled and starts to show over the poster. */
  onWarm: () => void;
  /** The layer over the pane that the cut between episodes dips to. */
  dip: React.RefObject<HTMLElement | null>;
}
