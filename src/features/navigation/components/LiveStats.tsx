'use client';

import { NAV_LEVELS } from '@/engine/navigation/course/levels';
import { NAV_METRIC } from '@/engine/navigation/pipeline/metricSpecs';
import { HudChip } from '@/features/lab/components/HudChip';
import { useNavigationLab } from '../state/labStore';
import type { LabFeeds } from '../viewport/labFeeds';
import { useRunnerCounts } from './useRunnerCounts';

const percent = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '-' : `${Math.round(v * 100)}%`);

/**
 * Generation, level, and how the runners are doing, top left of the
 * viewport. While a generation plays: running, finished, died and the
 * best progress on screen. Otherwise the latest generation's shares, but
 * never in the Sandbox, whose runners are not training's: there the
 * counts wait as dashes.
 */
export function LiveStats({ feeds }: { feeds: LabFeeds | null }) {
  const live = useRunnerCounts(feeds);
  const gen = useNavigationLab((s) => s.liveGeneration);
  const sandbox = useNavigationLab((s) => s.mode === 'sandbox');
  const last = useNavigationLab((s) => s.records[s.records.length - 1]);
  const level = NAV_LEVELS[live.level] ?? NAV_LEVELS[0];
  // A Sandbox course goes by its own name, such as one the user drew.
  const name = useNavigationLab((s) => (s.mode === 'sandbox' ? s.sandbox.lineup?.spec.name : undefined)) ?? level.name;
  return (
    <div className="pointer-events-none flex flex-wrap gap-1.5">
      {!sandbox && <HudChip label="Generation" value={gen + 1} tour="hud-generation" />}
      {/* Keyed on the level, so a level up pops the chip in afresh. */}
      <div key={`${level.level}:${name}`} className="animate-pop-in">
        <HudChip label="Level" value={level.level} note={name} tour="hud-level" />
      </div>
      {live.watching || sandbox ? (
        <>
          <HudChip label="Running" value={live.watching ? `${live.running} / ${live.total}` : '-'} />
          <HudChip label="Finished" value={live.watching ? live.finished : '-'} />
          <HudChip label="Died" value={live.watching ? live.died : '-'} />
          <HudChip label="Best progress" value={live.watching ? percent(live.best) : '-'} />
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
