'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { qualityChosen, useSettings } from '@/features/settings/settingsStore';
import { useLabQuality } from '@/features/settings/useLabQuality';
import { HeroArenaCanvas } from '@/render/hero/arena/HeroArenaCanvas';
import { HeroCarCanvas } from '@/render/hero/car/HeroCarCanvas';
import { cn } from '@/ui/cn';
import { heroTier } from '../heroMode';
import { SCENE_FADE_MS, type HeroScene, type SceneReady } from '../sceneCycle';
import { HeroPanels } from './HeroPanels';
import { SceneBoundary } from './SceneBoundary';
import { useArenaMatch } from './useArenaMatch';
import { useSceneCycle } from './useSceneCycle';
import { useShowcase } from './useShowcase';

export interface HeroLiveProps {
  /** The hero is on screen and the tab is visible. Nothing draws or simulates otherwise. */
  active: boolean;
  /** Told whenever another scene starts to fade in, so the page can match its scrim to it. */
  onScene: (scene: HeroScene) => void;
}

/** One full bleed scene, faded in or out with the cycle. */
function Layer({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div className={cn('absolute inset-0 transition-opacity ease-in-out', visible ? 'opacity-100' : 'opacity-0')} style={{ transitionDuration: `${SCENE_FADE_MS}ms` }}>
      {children}
    </div>
  );
}

/**
 * The live half of the landing hero, loaded after first paint on capable
 * devices: one replay worker plays a trained car and a Hide and Seek
 * match, two canvases draw them with the labs' own renderers, and they
 * crossfade every few seconds. A scene draws and simulates only while it
 * is visible or fading (the car also while it warms up behind the
 * poster), and everything stops while the hero is off screen. The arena
 * only starts loading once the car is on screen, and then warms up
 * without drawing, so getting it ready never stalls the car.
 */
export default function HeroLive({ active, onScene }: HeroLiveProps) {
  // The labs' ?quality= works here too, which the poster capture script relies on.
  const [pin] = useState(() => new URLSearchParams(window.location.search).get('quality'));
  const quality = useLabQuality(pin);
  const chosen = useSettings(qualityChosen);
  const weakGpu = useSettings((s) => s.weakGpu === true);
  const tier = heroTier(quality, chosen, weakGpu);
  const [shown, setShown] = useState<SceneReady>({ car: false, arena: false });
  const { pool, car, arena } = useShowcase(shown.car);
  const { scene, fading } = useSceneCycle(shown, active);
  const on = (s: HeroScene) => scene === s || fading;
  const match = useArenaMatch(pool, arena, active && on('arena'));
  const carShown = useCallback(() => setShown((s) => (s.car ? s : { ...s, car: true })), []);
  const arenaShown = useCallback(() => setShown((s) => (s.arena ? s : { ...s, arena: true })), []);
  const carOn = on('car');

  useEffect(() => {
    if (pool && car) void pool.replay.setGhostsPaused(!(active && carOn));
  }, [pool, car, active, carOn]);

  useEffect(() => onScene(scene), [scene, onScene]);

  const live = shown.car || shown.arena;
  return (
    <>
      {/* The data attributes say what is on screen, for the browser tests and scripts/capture-hero-poster.mjs. */}
      <div
        aria-hidden="true"
        data-hero-scene={live ? scene : 'none'}
        data-hero-shown={[shown.car && 'car', shown.arena && 'arena'].filter(Boolean).join(' ')}
        className={cn('absolute inset-0 transition-opacity duration-1000', live ? 'opacity-100' : 'opacity-0')}
      >
        {pool && car && (
          <Layer visible={scene === 'car'}>
            <SceneBoundary>
              <HeroCarCanvas track={car.track} stream={pool.car} schema={car.schema} tier={tier} running={active && (carOn || !shown.car)} onShown={carShown} />
            </SceneBoundary>
          </Layer>
        )}
        {pool && arena && match.room && (
          <Layer visible={scene === 'arena'}>
            <SceneBoundary>
              <HeroArenaCanvas room={match.room} stream={pool.arena} tier={tier} running={active && on('arena')} onShown={arenaShown} />
            </SceneBoundary>
          </Layer>
        )}
      </div>
      {pool && live && (
        <div aria-hidden="true" data-hero-panels className="pointer-events-none absolute inset-0 z-20 hidden animate-fade-in lg:block">
          <HeroPanels scene={scene} pool={pool} car={car} arena={arena} match={match} />
        </div>
      )}
    </>
  );
}
