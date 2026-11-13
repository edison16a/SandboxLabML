'use client';

import { useEffect, useMemo, useState } from 'react';
import type uPlot from 'uplot';
// The narrow modules, not the bench index, so the lab bundles never pull in the exam engines.
import { loadReferences } from '@/engine/bench/references';
import type { BenchReferences, ReferenceTier } from '@/engine/bench/types';
import { episodeInfo } from '@/engine/env/registry';
import type { EnvId } from '@/engine/env/types';
import { benchmarkData, benchmarkSeries, drawOrder, RUN_COLOR, TIER_COLORS } from './benchmarkSeries';
import { axis, generationAxis, UPlotChart } from './UPlotChart';

const tierName = (tier: ReferenceTier) => tier[0].toUpperCase() + tier.slice(1);

/** What the chart says before the first benchmark lands: the env's own line about its exam. */
function emptyText(env: EnvId): string {
  return episodeInfo(env)?.bench?.about ?? '';
}

/** Any record with a generation and, once benchmarked, its score. */
interface Scored {
  generation: number;
  benchmark?: number;
}

interface Props {
  env: EnvId;
  records: readonly Scored[];
  /** The reference the run's script matches (see matchingTier), drawn with its band. Null draws all three alike. */
  match?: ReferenceTier | null;
  height?: number;
}

/**
 * The run's benchmark score against the reference scripts' medians, with
 * the 25 to 75% band of the one its script matches. The scores come from
 * held-out exams (Driving: trips in two cities it never trained in), so a
 * curve that falls while fitness rises is overfitting to what training
 * shows it.
 */
export function BenchmarkChart({ env, records, match = null, height = 160 }: Props) {
  const [refs, setRefs] = useState<BenchReferences | null>(null);
  useEffect(() => {
    void loadReferences(env).then(setRefs);
  }, [env]);
  const points = useMemo(() => records.filter((r) => r.benchmark !== undefined), [records]);
  const order = useMemo(() => drawOrder(refs?.references ?? [], match), [refs, match]);

  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      scales: { x: { time: false }, y: { range: [0, 100] } },
      axes: [generationAxis(), axis('Score', 3)],
      ...benchmarkSeries(order, match),
      cursor: { points: { size: 5 } },
    }),
    [order, match],
  );
  const data = useMemo(() => benchmarkData(order, match, points), [order, match, points]);

  if (!points.length) {
    return <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-[12px] text-subtle">{emptyText(env)}</div>;
  }
  // The legend lists the run, then its own reference, then the others in tier order.
  const legend = [...(refs?.references ?? [])].sort((a, b) => Number(b.tier === match) - Number(a.tier === match));
  return (
    <div className="flex flex-col gap-1.5">
      <div style={{ height }}>
        <UPlotChart options={options} data={data} className="h-full w-full" />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: RUN_COLOR }} />
          This run
        </span>
        {legend.map((t) =>
          t.tier === match ? (
            <span key={t.tier} className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-3 items-center rounded-[2px]" style={{ background: `${TIER_COLORS[t.tier]}2e` }}>
                <span className="h-[1.5px] w-full" style={{ background: TIER_COLORS[t.tier] }} />
              </span>
              {tierName(t.tier)} script, middle half shaded
            </span>
          ) : (
            <span key={t.tier} className="flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed" style={{ borderColor: TIER_COLORS[t.tier] }} />
              {tierName(t.tier)} script
            </span>
          ),
        )}
      </div>
    </div>
  );
}
