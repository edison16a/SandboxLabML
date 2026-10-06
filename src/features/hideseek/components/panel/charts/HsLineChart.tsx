'use client';

import { useMemo } from 'react';
import type uPlot from 'uplot';
import { axis, UPlotChart } from '@/features/charts/UPlotChart';

export interface Series {
  label: string;
  color: string;
  /** Null leaves a gap, for numbers only some generations have. */
  values: Array<number | null>;
  width?: number;
  dash?: number[];
  fill?: boolean;
}

interface Props {
  generations: number[];
  series: Series[];
  yLabel: string;
  height?: number;
  /** Fixed y range, e.g. 0 to 100 for shares. */
  range?: [number, number];
}

/**
 * A small line chart over generations, in the house uPlot style. Every
 * Hide and Seek progress chart is one of these with its own series, so the
 * charts read alike: hiders always blue, seekers always red.
 */
export function HsLineChart({ generations, series, yLabel, height = 150, range }: Props) {
  const key = series.map((s) => s.label).join('|');
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { drag: { x: true, y: false }, points: { size: 5 } },
      scales: { x: { time: false }, y: range ? { range: () => range } : {} },
      axes: [axis('Generation'), axis(yLabel, 3)],
      series: [{}, ...series.map((s) => ({ label: s.label, stroke: s.color, width: s.width ?? 1.75, dash: s.dash, fill: s.fill ? `${s.color}18` : undefined, spanGaps: true }))],
    }),
    // The series shape only changes when the labels do; values flow through `data`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, yLabel, range?.[0], range?.[1]],
  );
  const data = useMemo<uPlot.AlignedData>(() => [generations, ...series.map((s) => s.values)], [generations, series]);
  return (
    <div style={{ height }}>
      <UPlotChart options={options} data={data} className="h-full w-full" />
    </div>
  );
}

/** Chart legend chips, so the series can be told apart without hovering. */
export function Legend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`w-3.5 border-t-2 ${i.dashed ? 'border-dashed' : 'border-solid'}`} style={{ borderColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
