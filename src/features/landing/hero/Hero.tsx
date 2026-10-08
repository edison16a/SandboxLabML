'use client';

import { lazy, Suspense, useRef } from 'react';
import { HeroContent } from './HeroContent';
import { HeroPoster } from './HeroPoster';
import { useHeroActive } from './useHeroActive';
import { useHeroMode } from './useHeroMode';

/** The live scenes and everything they need (three.js, the renderers, the worker) load only when asked for. */
const HeroLive = lazy(() => import('./live/HeroLive'));

/**
 * The landing hero: the first screen under the header, with the racing
 * scene and the Hide and Seek arena side by side (one above the other on
 * a tall screen). The poster, a still of both, and the centered text are
 * in the server HTML; on capable devices the live scenes load after first
 * paint and fade in over the poster. The text sits on its own blurred
 * panel rather than under a scrim over the whole picture, so the scenes
 * keep their color. The hero is one screen tall, down to a floor that
 * still holds the tightened text of a short window, so nothing is clipped.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mode = useHeroMode();
  const active = useHeroActive(ref);
  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative isolate flex h-[calc(100dvh-3rem)] min-h-[280px] items-center justify-center overflow-hidden bg-bg">
      <div aria-hidden="true" className="absolute inset-0">
        <HeroPoster />
      </div>
      {mode === 'live' && (
        <Suspense fallback={null}>
          <HeroLive active={active} hero={ref} panel={panel} />
        </Suspense>
      )}
      <HeroContent ref={panel} />
    </section>
  );
}
