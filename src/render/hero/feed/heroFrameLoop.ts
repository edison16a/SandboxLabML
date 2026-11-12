import { useFrameLoop, type FrameLoop } from '@/render/shared/frameLoop';
import type { HeroTier } from './sceneProps';

/**
 * Frames per second the hero draws at on Low. Both simulations tick at
 * 30 Hz, so a frame drawn between two ticks only blends them: Low skips
 * those and halves the GPU work of two scenes on a weak machine.
 */
const LOW_FPS = 30;

/**
 * The frame loop of a hero scene: the Settings frame rate while it runs,
 * held on its last frame while the hero is off screen or the tab hidden,
 * and never faster than LOW_FPS on Low.
 */
export function useHeroFrameLoop(running: boolean, tier: HeroTier): FrameLoop {
  const loop = useFrameLoop(running ? 'live' : 'held');
  if (!running || tier !== 'low') return loop;
  return { activity: 'live', fps: Math.min(loop.fps ?? LOW_FPS, LOW_FPS), frameloop: 'never' };
}
