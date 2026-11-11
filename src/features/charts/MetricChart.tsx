'use client';

import { useMemo } from 'react';
import uPlot from 'uplot';
import { metricValue, type MetricSpec } from '@/engine/env/metrics';
import type { GenerationRecord } from '@/engine/training/records';
import { axis, generationAxis, UPlotChart } from './UPlotChart';

const LINE = '#4c9aff';
const BEST = '#3ecf8e';
/** Holds the best so far until the next record beats it. Built once, since a path builder never changes. */
const steps = uPlot.paths.stepped?.({ align: 1 });

/**
 * Each generation's value of one env metric, with the best so far as a
 * dashed step line, so a curriculum level or an arrival share reads at a
 * glance.
 * Generations without a value leave a gap. Ticks use the metric's own
 * format, so a share reads as a percent and a time as seconds.
 */
export function MetricChart({ records, spec, height = 150 }: { records: GenerationRecord[]; spec: MetricSpec; height?: number }) {
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { drag: { x: true, y: false }, points: { size: 6 } },
      scales: { x: { time: false } },
      axes: [generationAxis(), { ...axis(spec.unit ? `${spec.label} (${spec.unit})` : spec.label, 3), values: (_u, splits) => splits.map((v) => spec.format(v)) }],
      // The best so far is drawn first and dashed, so where it equals this generation's value the value stays on top.
      series: [
        {},
        { label: 'Best so far', stroke: BEST, width: 1.5, dash: [4, 4], paths: steps, points: { show: false } },
        { label: spec.label, stroke: LINE, width: 2, fill: `${LINE}14`, points: { show: false } },
      ],
    }),
    [spec],
  );
  const data = useMemo<uPlot.AlignedData>(() => {
    const values = records.map((r) => metricValue(r, spec));
    const best: Array<number | null> = [];
    let top = NaN;
    for (const v of values) {
      if (Number.isFinite(v) && (!Number.isFinite(top) || (spec.better === 'higher' ? v > top : v < top))) top = v;
      best.push(Number.isFinite(top) ? top : null);
    }
    return [records.map((r) => r.generation + 1), best, values.map((v) => (Number.isFinite(v) ? v : null))];
  }, [records, spec]);
  return (
    <div style={{ height }}>
      <UPlotChart options={options} data={data} className="h-full w-full" />
    </div>
  );
}
