'use client';

import { useEffect, useState, type RefObject } from 'react';

/** The share of the hero that must be on screen for it to draw. */
const ON_SCREEN = 0.02;

/**
 * Whether the hero is worth drawing: at least partly on screen and in a
 * visible tab. The live scenes and their simulations pause otherwise, so
 * a visitor reading the feature list below costs no GPU time.
 */
export function useHeroActive(ref: RefObject<HTMLElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A sliver of the hero at the edge of the screen still counts as intersecting, so the share decides: under 2% is off screen.
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting && entry.intersectionRatio >= ON_SCREEN), { threshold: ON_SCREEN });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return onScreen && visible;
}
