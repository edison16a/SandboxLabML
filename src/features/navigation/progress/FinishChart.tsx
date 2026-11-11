'use client';

import { useMemo } from 'react';
import type uPlot from 'uplot';
import { NAV_METRIC } from '@/engine/navigation/pipeline/metricSpecs';
import type { GenerationRecord } from '@/engine/training/records';
import { axis, generationAxis, UPlotChart } from '@/features/charts/UPlotChart';

/** The three lines, in drawing order: deaths underneath, the whole population, the best fifth on top. */
export const FINISH_SERIES = [
  { key: NAV_METRIC.deathShare, label: 'Died', color: '#ff5f5f', dash: [4, 4] },
  { key: NAV_METRIC.finishShare, label: 'Everyone finished', color: '#4c9aff' },
  { key: NAV_METRIC.eliteShare, label: 'Best fifth finished', color: '#3dd68c' },
] as const;

/**
 * Per generation shares of runs that finished, for the best fifth and for
 * everyone, and of runs that died. The best fifth is what the curriculum
 * climbs on; the gap down to everyone is the mutated rest of the
 * population, which catches up while a level lasts.
 */
export function FinishChart({ records, height = 160 }: { records: GenerationRecord[]; height?: number }) {
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { drag: { x: true, y: false }, points: { size: 6 } },
      scales: { x: { time: false }, y: { range: [0, 1] } },
      axes: [generationAxis(), { ...axis('Share of runs', 3), splits: () => [0, 0.25, 0.5, 0.75, 1], values: (_u, splits) => splits.map((v) => `${Math.round(v * 100)}%`) }],
      series: [
        {},
        ...FINISH_SERIES.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: s.key === NAV_METRIC.eliteShare ? 2 : 1.5,
          ...('dash' in s && { dash: [...s.dash] }),
          ...(s.key === NAV_METRIC.finishShare && { fill: `${s.color}14` }),
          points: { size: 4 },
        })),
      ],
    }),
    [],
  );
  const data = useMemo<uPlot.AlignedData>(() => [records.map((r) => r.generation + 1), ...FINISH_SERIES.map((s) => records.map((r) => r.metrics?.[s.key] ?? null))], [records]);
  return (
    <div style={{ height }}>
      <UPlotChart options={options} data={data} className="h-full w-full" />
    </div>
  );
}
