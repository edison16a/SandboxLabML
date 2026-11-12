'use client';

import { useEffect, useState } from 'react';
import { HERO_DRIVER_PATH, parseHeroDriver } from '@/engine/hero/driver/file';
import { HERO_NAVIGATOR_PATH, parseHeroNavigator } from '@/engine/hero/navigator/file';
import { DriveFeed } from '@/render/hero/driving/driveFeed';
import { RunFeed } from '@/render/hero/navigation/runFeed';

export interface HeroFeeds {
  drive: DriveFeed | null;
  run: RunFeed | null;
  /** True once both files have been tried, whatever came of it. */
  settled: boolean;
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(path);
  return res.ok ? res.json() : null;
}

/**
 * Fetches the two hero brains and builds a simulation for each. Either one
 * may fail on its own (a stale file after an engine change, a blocked
 * fetch), and its half of the hero then keeps its poster. `still` holds
 * both on their opening tick, for the poster capture.
 */
export function useHeroFeeds(still: boolean): HeroFeeds {
  const [feeds, setFeeds] = useState<HeroFeeds>({ drive: null, run: null, settled: false });

  useEffect(() => {
    let gone = false;
    const load = async <F,>(path: string, make: (data: unknown) => F | null): Promise<F | null> => {
      try {
        return make(await fetchJson(path));
      } catch {
        return null;
      }
    };
    void Promise.all([
      load(HERO_DRIVER_PATH, (d) => {
        const driver = parseHeroDriver(d);
        return driver ? new DriveFeed(driver) : null;
      }),
      load(HERO_NAVIGATOR_PATH, (d) => {
        const navigator = parseHeroNavigator(d);
        return navigator ? new RunFeed(navigator) : null;
      }),
    ]).then(([drive, run]) => {
      if (gone) return;
      if (drive) drive.frozen = still;
      if (run) run.frozen = still;
      setFeeds({ drive, run, settled: true });
    });
    return () => {
      gone = true;
    };
  }, [still]);

  return feeds;
}
