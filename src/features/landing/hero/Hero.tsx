'use client';

import { lazy, Suspense, useRef } from 'react';
import { HeroContent } from './HeroContent';
import { HeroPoster } from './HeroPoster';
import { useHeroActive } from './useHeroActive';
import { useHeroMode } from './useHeroMode';

/** The live scenes and everything they need (three.js, the renderers, the worker) load only when asked for. */
const HeroLive = lazy(() => import('./live/HeroLive'));

/**
 * The landing hero: the first screen under the header. The poster and the
 * centered text are in the server HTML; on capable devices the live
 * scenes load after first paint and fade in over the poster. A flat scrim
 * between the scene and the text keeps the words readable on any frame,
 * white kerbs and barriers included, at 4.5:1 or better for the small
 * lines. The hero is one screen tall, down to a floor that still holds the
 * tightened text of a short window, so nothing is ever clipped.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const mode = useHeroMode();
  const active = useHeroActive(ref);
  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative isolate flex h-[calc(100dvh-3rem)] min-h-[280px] items-center justify-center overflow-hidden bg-bg">
      <div aria-hidden="true" className="absolute inset-0">
        <HeroPoster />
      </div>
      {mode === 'live' && (
        <Suspense fallback={null}>
          <HeroLive active={active} />
        </Suspense>
      )}
      <div aria-hidden="true" data-hero-scrim className="absolute inset-0 z-10 bg-bg opacity-60" />
      <HeroContent />
    </section>
  );
}
