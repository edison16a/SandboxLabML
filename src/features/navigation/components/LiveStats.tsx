'use client';

import { useEffect, useState } from 'react';
import { NAV_DIED, NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';
import { NAV_LEVELS } from '@/engine/navigation/course/levels';
import { NAV_METRIC } from '@/engine/navigation/pipeline/metricSpecs';
import { NAVIGATION_SNAPSHOT, SNAP_PROGRESS, SNAP_STATUS } from '@/engine/navigation/snapshot';
import { HudChip } from '@/features/lab/components/HudChip';
import { useNavigationLab } from '../state/labStore';
import type { LabFeeds } from '../viewport/labFeeds';

const STRIDE = NAVIGATION_SNAPSHOT.stride;

interface Live {
  watching: boolean;
  level: number;
  running: number;
  finished: number;
  died: number;
  total: number;
  best: number;
}

const NONE: Live = { watching: false, level: 0, running: 0, finished: 0, died: 0, total: 0, best: 0 };

/** Counts the live population four times a second, so the chips never redraw per frame. */
function useLive(feeds: LabFeeds | null): Live {
  const [live, setLive] = useState<Live>(NONE);
  useEffect(() => {
    if (!feeds) return;
    const id = setInterval(() => {
      const s = useNavigationLab.getState();
      const level = feeds.level(s);
      const feed = feeds.population;
      if (!feeds.showsPopulation(s) || !feed.curr) return setLive((l) => (l.watching || l.level !== level ? { ...NONE, level } : l));
      const next: Live = { watching: true, level, running: 0, finished: 0, died: 0, total: feed.count, best: 0 };
      for (let i = 0; i < feed.count; i++) {
        const status = feed.curr[i * STRIDE + SNAP_STATUS];
        if (status === NAV_RUNNING) next.running++;
        else if (status === NAV_FINISHED) next.finished++;
        else if (status === NAV_DIED) next.died++;
        next.best = Math.max(next.best, status === NAV_FINISHED ? 1 : feed.curr[i * STRIDE + SNAP_PROGRESS]);
      }
      setLive(next);
    }, 250);
    return () => clearInterval(id);
  }, [feeds]);
  return live;
}

const percent = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '-' : `${Math.round(v * 100)}%`);

/**
 * Generation, level, and how the runners are doing, top left of the
 * viewport. While a generation plays: running, finished, died and the
 * best progress on screen. Otherwise the latest generation's shares.
 */
export function LiveStats({ feeds }: { feeds: LabFeeds | null }) {
  const live = useLive(feeds);
  const gen = useNavigationLab((s) => s.liveGeneration);
  const last = useNavigationLab((s) => s.records[s.records.length - 1]);
  const level = NAV_LEVELS[live.level] ?? NAV_LEVELS[0];
  return (
    <div className="pointer-events-none flex flex-wrap gap-1.5">
      <HudChip label="Generation" value={gen + 1} tour="hud-generation" />
      <HudChip label="Level" value={level.level} note={level.name} tour="hud-level" />
      {live.watching ? (
        <>
          <HudChip label="Running" value={`${live.running} / ${live.total}`} />
          <HudChip label="Finished" value={live.finished} />
          <HudChip label="Died" value={live.died} />
          <HudChip label="Best progress" value={percent(live.best)} />
        </>
      ) : (
        <>
          <HudChip label="Finished" value={percent(last?.metrics?.[NAV_METRIC.finishShare])} />
          <HudChip label="Died" value={percent(last?.metrics?.[NAV_METRIC.deathShare])} />
          <HudChip label="Best progress" value={percent(last?.champion.metrics?.[NAV_METRIC.progress])} />
        </>
      )}
    </div>
  );
}
