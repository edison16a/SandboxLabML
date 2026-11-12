'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { HeroFeed } from './heroFeed';

/** Runs before the scenes' own frame drivers, which read what this frame's ticks wrote. */
const STEPPER_PRIORITY = -300;

interface Props {
  feed: HeroFeed;
  /** False until the scene is on screen: the simulation waits on its opening tick, the one the poster shows. */
  live: React.RefObject<boolean>;
  /** The page colored layer over the pane that the cut between episodes dips to. */
  dip: React.RefObject<HTMLElement | null>;
}

/**
 * Moves a hero simulation on by each frame's real time and sets how dark
 * the cut is. It lives in the canvas's frame loop, so the simulation stops
 * whenever the canvas does: off screen, in a hidden tab, while warming up.
 */
export function FeedStepper({ feed, live, dip }: Props) {
  const shown = useMemo(() => ({ dark: -1 }), []);
  useFrame((_, dt) => {
    if (live.current) feed.advance(dt);
    // Rounded so the style is only written when the dip visibly moves.
    const dark = Math.round(feed.darkness() * 200) / 200;
    if (dark !== shown.dark && dip.current) {
      shown.dark = dark;
      dip.current.style.opacity = String(dark);
    }
  }, STEPPER_PRIORITY);
  return null;
}
