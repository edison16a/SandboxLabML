'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { qualityChosen, useSettings } from '@/features/settings/settingsStore';
import { useLabQuality } from '@/features/settings/useLabQuality';
import { HeroDriveScene } from '@/render/hero/driving/HeroDriveScene';
import { HeroRunScene } from '@/render/hero/navigation/HeroRunScene';
import { cn } from '@/ui/cn';
import { heroTier } from '../heroMode';
import type { SceneReady } from '../scenes';
import { HeroLoading } from './HeroLoading';
import { HeroPane } from './HeroPane';
import { HeroPanels } from './HeroPanels';
import { SceneBoundary } from './SceneBoundary';
import { useHeroFeeds } from './useHeroFeeds';
import { useSplitLayout } from './useSplitLayout';

/** How long the course waits for the city to reach the screen before it starts anyway, ms. */
const RUN_FALLBACK_MS = 10_000;

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
 * devices: a trained SUV driving through the city and a trained runner
 * crossing its courses, each simulated on this thread by its real brain
 * and drawn by its lab's own renderer in a canvas over its half of the
 * poster. The course only starts warming up once the city is on screen,
 * so the two never compete for the first frames. Everything stops while
 * the hero is off screen or the tab is hidden.
 */
export default function HeroLive({ active, hero, panel }: HeroLiveProps) {
  // The labs' ?quality= works here too, and ?hero=still holds both scenes on their opening tick for scripts/capture-hero-poster.mjs.
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const quality = useLabQuality(params.get('quality'));
  const chosen = useSettings(qualityChosen);
  const weakGpu = useSettings((s) => s.weakGpu === true);
  const tier = heroTier(quality, chosen, weakGpu);
  const feeds = useHeroFeeds(params.get('hero') === 'still');
  const split = useSplitLayout(hero, panel);
  const layout = split?.layout ?? null;
  const [shown, setShown] = useState<SceneReady>({ drive: false, run: false });
  const [waited, setWaited] = useState(false);
  const driveDip = useRef<HTMLDivElement>(null);
  const runDip = useRef<HTMLDivElement>(null);
  const driveShown = useCallback(() => setShown((s) => (s.drive ? s : { ...s, drive: true })), []);
  const runShown = useCallback(() => setShown((s) => (s.run ? s : { ...s, run: true })), []);

  useEffect(() => {
    if (!feeds.settled || shown.drive) return;
    const timer = setTimeout(() => setWaited(true), RUN_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [feeds.settled, shown.drive]);

  const runGo = feeds.run !== null && (shown.drive || feeds.drive === null || waited);
  const live = shown.drive || shown.run;
  // Still loading while a scene that loaded has not reached the screen. One that failed keeps its poster.
  const waiting = !feeds.settled || (feeds.drive !== null && !shown.drive) || (feeds.run !== null && !shown.run);
  return (
    <>
      <HeroLoading loading={waiting} />
      {/* The data attributes say which scenes are on screen and which poster frame they follow, for the browser tests and the poster capture. */}
      <div
        aria-hidden="true"
        data-hero-shown={[shown.drive && 'drive', shown.run && 'run'].filter(Boolean).join(' ')}
        data-hero-frame={split ? JSON.stringify(split.frame) : undefined}
        className="pointer-events-none absolute inset-0"
      >
        {layout && feeds.drive && (
          <HeroPane rect={layout.drive.rect} shown={shown.drive} running={active} dip={driveDip} scene="drive">
            <SceneBoundary>
              <HeroDriveScene feed={feeds.drive} tier={tier} pane={layout.drive} running={active} onWarm={driveShown} dip={driveDip} />
            </SceneBoundary>
          </HeroPane>
        )}
        {layout && feeds.run && runGo && (
          <HeroPane rect={layout.run.rect} shown={shown.run} running={active} dip={runDip} scene="run">
            <SceneBoundary>
              <HeroRunScene feed={feeds.run} tier={tier} pane={layout.run} running={active} onWarm={runShown} dip={runDip} />
            </SceneBoundary>
          </HeroPane>
        )}
      </div>
      {layout && live && (
        // A hairline between the scenes, so they read as two views rather than one broken picture.
        <div aria-hidden="true" className={cn('pointer-events-none absolute z-10 animate-fade-in bg-bg', layout.stacked ? 'inset-x-0 h-0.5' : 'inset-y-0 w-0.5')} style={layout.stacked ? { top: layout.run.rect.y - 1 } : { left: layout.run.rect.x - 1 }} />
      )}
      {layout && live && (
        <div aria-hidden="true" data-hero-panels className="pointer-events-none absolute inset-0 z-20 hidden animate-fade-in hero-cards:block">
          <HeroPanels stacked={layout.stacked} drive={shown.drive ? feeds.drive : null} run={shown.run ? feeds.run : null} />
        </div>
      )}
    </>
  );
}
