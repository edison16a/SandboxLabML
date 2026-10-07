'use client';

import { lazy, Suspense, useRef, useState } from 'react';
import { cn } from '@/ui/cn';
import { HeroContent } from './HeroContent';
import { HeroPoster } from './HeroPoster';
import { useHeroActive } from './useHeroActive';
import { useHeroMode } from './useHeroMode';
import type { HeroScene } from './sceneCycle';

/** The live scenes and everything they need (three.js, the renderers, the worker) load only when asked for. */
const HeroLive = lazy(() => import('./live/HeroLive'));

/**
 * The landing hero: the first screen under the header. The poster and the
 * centered text are in the server HTML; on capable devices the live
 * scenes load after first paint and fade in over the poster. A flat scrim
 * between the scene and the text keeps the words readable on any frame;
 * the pale Hide and Seek room needs a little more of it than the circuit.
 * The hero is one screen tall, down to a floor that still holds the
 * tightened text of a short window, so nothing is ever clipped.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const mode = useHeroMode();
  const active = useHeroActive(ref);
  const [scene, setScene] = useState<HeroScene>('car');
  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative isolate flex h-[calc(100dvh-3rem)] min-h-[280px] items-center justify-center overflow-hidden bg-bg">
      <div aria-hidden="true" className="absolute inset-0">
        <HeroPoster />
      </div>
      {mode === 'live' && (
        <Suspense fallback={null}>
          <HeroLive active={active} onScene={setScene} />
        </Suspense>
      )}
      <div aria-hidden="true" data-hero-scrim className={cn('absolute inset-0 z-10 bg-bg transition-opacity duration-[1400ms]', scene === 'arena' ? 'opacity-60' : 'opacity-50')} />
      <HeroContent />
    </section>
  );
}
