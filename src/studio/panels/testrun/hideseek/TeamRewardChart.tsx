'use client';

import { useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { axis, UPlotChart } from '@/features/charts/UPlotChart';
import { Segmented } from '@/ui/primitives/Segmented';
import type { MatchLog } from './types';

const HIDER = '#4c9aff';
const SEEKER = '#ff5f6d';
const PREP_SHADE = 'rgba(138, 148, 167, 0.08)';

type View = 'total' | 'tick';

/** Shades the prep phase behind the lines, since neither team usually scores until the seeker is loose. */
function shadePrep(until: number) {
  return (u: uPlot) => {
    const x0 = u.valToPos(u.scales.x.min ?? 0, 'x', true);
    const x1 = u.valToPos(until, 'x', true);
    u.ctx.save();
    u.ctx.fillStyle = PREP_SHADE;
    u.ctx.fillRect(x0, u.bbox.top, Math.max(0, x1 - x0), u.bbox.height);
    u.ctx.restore();
  };
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/**
 * Both teams' rewards over the match: running totals by default, or the
 * points each tick gave. Prep is shaded so the start of seeking is easy
 * to find.
 */
export function TeamRewardChart({ log, prepSeconds }: { log: MatchLog; prepSeconds: number }) {
  const [view, setView] = useState<View>('total');
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { points: { size: 5 } },
      scales: { x: { time: false } },
      axes: [axis('Seconds'), axis(view === 'total' ? 'Total reward' : 'Reward per tick', 3)],
      series: [{}, { label: 'Hider', stroke: HIDER, width: 2 }, { label: 'Seeker', stroke: SEEKER, width: 2 }],
      hooks: { drawClear: [shadePrep(prepSeconds)] },
    }),
    [view, prepSeconds],
  );
  const data = useMemo<uPlot.AlignedData>(() => {
    const [h, s] = view === 'total' ? [log.hiderTotal, log.seekerTotal] : [log.hiderReward, log.seekerReward];
    return [Array.from(log.time), Array.from(h), Array.from(s)];
  }, [log, view]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span className="flex items-center gap-3">
          <Key color={HIDER} label="Hider" />
          <Key color={SEEKER} label="Seeker" />
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-border" style={{ background: PREP_SHADE }} />
            Prep
          </span>
        </span>
        <Segmented<View>
          label="Reward view"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'total', label: 'Running total' },
            { value: 'tick', label: 'Per tick' },
          ]}
        />
      </div>
      <div className="h-44" aria-label={view === 'total' ? 'Hider and seeker total reward over time' : 'Hider and seeker reward per tick'} role="img">
        <UPlotChart options={options} data={data} className="h-full w-full" />
      </div>
    </div>
  );
}
