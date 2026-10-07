'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether the hero is worth drawing: at least partly on screen and in a
 * visible tab. The live scenes and the worker behind them pause otherwise,
 * so a visitor reading the feature list below costs no GPU time.
 */
export function useHeroActive(ref: RefObject<HTMLElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.02 });
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
