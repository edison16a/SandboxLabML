'use client';

import { useMemo } from 'react';
import type uPlot from 'uplot';
import { modelMetrics } from '@/engine/neat/metrics';
import type { GenerationRecord } from '@/engine/training/records';
import { axis, generationAxis, UPlotChart } from '@/features/charts/UPlotChart';

/**
 * Parameters and size of each generation's champion, next to a flat line for
 * the blueprint's starting brain, so growth is measured against where it began.
 */
export function GrowthChart({ records, reference }: { records: GenerationRecord[]; reference: number }) {
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { points: { size: 5 } },
      scales: { x: { time: false }, kb: { auto: true } },
      axes: [generationAxis(), axis('Parameters', 3), { ...axis('KB', 1), scale: 'kb', grid: { show: false } }],
      series: [
        {},
        { label: 'Parameters', stroke: '#4c9aff', width: 2 },
        { label: 'Starting brain', stroke: '#5d6779', width: 1, dash: [4, 4] },
        { label: 'Size', stroke: '#ff9f43', width: 1.5, scale: 'kb' },
      ],
    }),
    [],
  );
  const data = useMemo<uPlot.AlignedData>(() => {
    const m = records.map((r) => modelMetrics(r.genome));
    return [records.map((r) => r.generation + 1), m.map((x) => x.parameters), records.map(() => reference), m.map((x) => x.bytes / 1024)];
  }, [records, reference]);
  return (
    <div className="h-36">
      <UPlotChart options={options} data={data} className="h-full w-full" />
    </div>
  );
}
