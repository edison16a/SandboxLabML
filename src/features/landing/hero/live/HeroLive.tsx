'use client';

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { qualityChosen, useSettings } from '@/features/settings/settingsStore';
import { useLabQuality } from '@/features/settings/useLabQuality';
import { HeroStage } from '@/render/hero/stage/HeroStage';
import { cn } from '@/ui/cn';
import { heroTier } from '../heroMode';
import type { HeroScene, SceneReady } from '../scenes';
import { HeroPanels } from './HeroPanels';
import { SceneBoundary } from './SceneBoundary';
import { useArenaMatch } from './useArenaMatch';
import { useShowcase } from './useShowcase';
import { useSplitLayout } from './useSplitLayout';

export interface HeroLiveProps {
  /** The hero is on screen and the tab is visible. Nothing draws or simulates otherwise. */
  active: boolean;
  /** The hero section, which the scenes fill. */
  hero: RefObject<HTMLElement | null>;
  /** The centered text panel, which the scenes frame their subjects around. */
  panel: RefObject<HTMLElement | null>;
}

/**
 * The live half of the landing hero, loaded after first paint on capable
 * devices: one replay worker plays a trained car and a Hide and Seek
 * match, and one canvas draws both side by side with the labs' own
 * renderers, each fading in over its half of the poster once it is warm.
 * Everything stops while the hero is off screen. The arena only starts
 * loading once the car is on screen, so getting it ready never stalls
 * the car.
 */
export default function HeroLive({ active, hero, panel }: HeroLiveProps) {
  // The labs' ?quality= works here too, which the poster capture script relies on.
  const [pin] = useState(() => new URLSearchParams(window.location.search).get('quality'));
  const quality = useLabQuality(pin);
  const chosen = useSettings(qualityChosen);
  const weakGpu = useSettings((s) => s.weakGpu === true);
  const tier = heroTier(quality, chosen, weakGpu);
  const [shown, setShown] = useState<SceneReady>({ car: false, arena: false });
  const { pool, car, arena } = useShowcase(shown.car);
  const match = useArenaMatch(pool, arena, active);
  const layout = useSplitLayout(hero, panel);
  const onShown = useCallback((scene: HeroScene) => setShown((s) => (s[scene] ? s : { ...s, [scene]: true })), []);

  useEffect(() => {
    if (pool && car) void pool.replay.setGhostsPaused(!active);
  }, [pool, car, active]);

  const stageCar = useMemo(() => (pool && car ? { track: car.track, stream: pool.car, schema: car.schema } : null), [pool, car]);
  const stageArena = useMemo(() => (pool && match.room ? { room: match.room, stream: pool.arena } : null), [pool, match.room]);
  const live = shown.car || shown.arena;
  return (
    <>
      {/* The data attribute says which scenes are on screen, for the browser tests and scripts/capture-hero-poster.mjs. */}
      <div aria-hidden="true" data-hero-shown={[shown.car && 'car', shown.arena && 'arena'].filter(Boolean).join(' ')} className="absolute inset-0">
        {layout && (stageCar || stageArena) && (
          <SceneBoundary>
            <HeroStage car={stageCar} arena={arena ? stageArena : null} layout={layout} tier={tier} running={active} onShown={onShown} />
          </SceneBoundary>
        )}
      </div>
      {layout && live && (
        // A hairline between the scenes, so they read as two views rather than one broken picture.
        <div aria-hidden="true" className={cn('pointer-events-none absolute z-10 animate-fade-in bg-bg', layout.stacked ? 'inset-x-0 h-0.5' : 'inset-y-0 w-0.5')} style={layout.stacked ? { top: layout.arena.rect.y - 1 } : { left: layout.arena.rect.x - 1 }} />
      )}
      {pool && live && layout && (
        <div aria-hidden="true" data-hero-panels className="pointer-events-none absolute inset-0 z-20 hidden animate-fade-in hero-cards:block">
          <HeroPanels stacked={layout.stacked} pool={pool} car={car} arena={arena} match={match} shown={shown} />
        </div>
      )}
    </>
  );
}
