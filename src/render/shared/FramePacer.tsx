'use client';

import { useStore, type RootStore } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { FrameLoop } from './frameLoop';
import { createPacer } from './pacing';

/**
 * Draws one frame by hand. With frameloop never the root clock stands
 * still, so the timestamp carries it forward by the real time since the
 * last frame and useFrame callbacks get an honest delta.
 */
function draw(store: RootStore, ms: number) {
  const state = store.getState();
  state.advance(state.clock.elapsedTime + ms / 1000, true);
}

/**
 * Drives a canvas from useFrameLoop. While the scene is live with a cap it
 * draws on the display frames closest to the target rate. In every mode it
 * also redraws right after the canvas resizes: resizing a canvas clears
 * it, and a held or capped view would otherwise flash empty while a panel
 * is dragged.
 */
export function FramePacer({ loop }: { loop: FrameLoop }) {
  const store = useStore();
  const pacing = loop.activity === 'live' && loop.fps !== null;
  const live = useRef({ pacing, resized: false });
  live.current.pacing = pacing;

  useEffect(() => {
    if (!pacing || loop.fps === null) return;
    const pace = createPacer(loop.fps);
    const interval = 1000 / loop.fps;
    let last = 0;
    let raf = requestAnimationFrame(function tick(t) {
      raf = requestAnimationFrame(tick);
      // A resize draws off the cadence so the cleared canvas is never shown, without moving the cadence itself.
      if (!pace(t) && !live.current.resized) return;
      draw(store, last ? t - last : interval);
      last = t;
      live.current.resized = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [pacing, loop.fps, store]);

  useEffect(() => {
    let pending = 0;
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.size === prev.size && s.viewport.dpr === prev.viewport.dpr) return;
      if (s.frameloop === 'demand') s.invalidate();
      else if (s.frameloop === 'never' && live.current.pacing) live.current.resized = true;
      else if (s.frameloop === 'never' && !pending) {
        pending = requestAnimationFrame(() => {
          pending = 0;
          draw(store, 0);
        });
      }
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(pending);
    };
  }, [store]);
  return null;
}
