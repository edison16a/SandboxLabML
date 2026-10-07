'use client';

import { useEffect, useState } from 'react';
import { heroMode, type HeroFacts, type HeroMode } from './heroMode';

/** Browser fields TypeScript's DOM types leave out. Both are missing outside Chromium. */
type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

function readFacts(): HeroFacts {
  const nav = navigator as NavigatorHints;
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: nav.connection?.saveData === true,
    width: window.innerWidth,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    screenShort: Math.min(window.screen.width, window.screen.height) || 0,
    cores: nav.hardwareConcurrency || 0,
    memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    webgl2: typeof WebGL2RenderingContext !== 'undefined',
  };
}

/** Runs `fn` once the browser is idle after load, or soon anyway where idle callbacks do not exist. */
function whenIdle(fn: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(fn, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
}

/**
 * Whether the hero goes live, decided in the browser after the page has
 * loaded and painted: null until then, so the server render and the first
 * paint are always the poster. Turning on reduced motion later drops the
 * hero back to its poster.
 */
export function useHeroMode(): HeroMode | null {
  const [mode, setMode] = useState<HeroMode | null>(null);

  useEffect(() => {
    let cancelIdle: (() => void) | null = null;
    const decide = () => {
      cancelIdle = whenIdle(() => setMode(heroMode(readFacts())));
    };
    if (document.readyState === 'complete') decide();
    else window.addEventListener('load', decide, { once: true });
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => motion.matches && setMode('poster');
    motion.addEventListener('change', onMotion);
    return () => {
      window.removeEventListener('load', decide);
      motion.removeEventListener('change', onMotion);
      cancelIdle?.();
    };
  }, []);

  return mode;
}
