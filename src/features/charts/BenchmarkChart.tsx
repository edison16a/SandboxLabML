'use client';

import { useEffect, useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { loadReferences, type BenchReferences } from '@/engine/bench';
import type { GenerationRecord } from '@/engine/training/records';
import { axis, UPlotChart } from './UPlotChart';

const TIER_COLORS = { beginner: '#5d6779', intermediate: '#8a94a7', advanced: '#ff9f43' } as const;

/**
 * The run's benchmark score every fifth generation against the reference
 * scripts' median and 25 to 75% band. Scores come from held-out roads, so a
 * curve that falls while fitness rises is overfitting to the training track.
 */
export function BenchmarkChart({ records, height = 160 }: { records: GenerationRecord[]; height?: number }) {
  const [refs, setRefs] = useState<BenchReferences | null>(null);
  useEffect(() => {
    void loadReferences('racing').then(setRefs);
  }, []);
  const points = useMemo(() => records.filter((r) => r.benchmark !== undefined), [records]);
  const tiers = useMemo(() => refs?.references ?? [], [refs]);

  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(() => {
    const series: uPlot.Series[] = [{}];
    const bands: uPlot.Band[] = [];
    tiers.forEach((t) => {
      const base = series.length;
      series.push({ label: `${t.tier} p75`, stroke: 'transparent', points: { show: false } });
      series.push({ label: `${t.tier} p25`, stroke: 'transparent', points: { show: false } });
      series.push({ label: t.tier, stroke: TIER_COLORS[t.tier], width: 1.25, dash: [4, 3], points: { show: false } });
      bands.push({ series: [base, base + 1], fill: `${TIER_COLORS[t.tier]}22` });
    });
    series.push({ label: 'This run', stroke: '#4c9aff', width: 2, points: { show: true, size: 5, fill: '#4c9aff' }, spanGaps: true });
    return {
      legend: { show: false },
      scales: { x: { time: false }, y: { range: [0, 100] } },
      axes: [axis('Generation'), axis('Score', 3)],
      series,
      bands,
      cursor: { points: { size: 5 } },
    };
  }, [tiers]);

  const data = useMemo<uPlot.AlignedData>(() => {
    const gens = new Set<number>();
    tiers.forEach((t) => t.curve.forEach((p) => gens.add(p.generation)));
    points.forEach((r) => gens.add(r.generation));
    const xs = [...gens].sort((a, b) => a - b);
    const cols: Array<Array<number | null>> = [];
    tiers.forEach((t) => {
      const at = new Map(t.curve.map((p) => [p.generation, p]));
      cols.push(xs.map((g) => at.get(g)?.p75 ?? null), xs.map((g) => at.get(g)?.p25 ?? null), xs.map((g) => at.get(g)?.median ?? null));
    });
    const mine = new Map(points.map((r) => [r.generation, r.benchmark ?? null]));
    cols.push(xs.map((g) => mine.get(g) ?? null));
    return [xs.map((g) => g + 1), ...cols] as uPlot.AlignedData;
  }, [tiers, points]);

  if (!points.length) {
    return <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-center text-[12px] text-subtle">The champion is scored on held-out roads every 5 generations.</div>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div style={{ height }}>
        <UPlotChart options={options} data={data} className="h-full w-full" />
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-accent" />
          This run
        </span>
        {tiers.map((t) => (
          <span key={t.tier} className="flex items-center gap-1.5 capitalize">
            <span className="h-0.5 w-3" style={{ background: TIER_COLORS[t.tier] }} />
            {t.tier} script
          </span>
        ))}
      </div>
    </div>
  );
}
