'use client';

import { useMemo } from 'react';
import type uPlot from 'uplot';
import type { GenerationRecord } from '@/engine/training/records';
import { axis, UPlotChart } from './UPlotChart';

/**
 * Best, mean and median fitness per generation. Script edits show up as
 * dashed vertical markers so a change in the curve can be traced to a change
 * in the rules.
 */
export function FitnessChart({ records, height = 180 }: { records: GenerationRecord[]; height?: number }) {
  const markers = useMemo(() => records.filter((r) => r.markers?.length).map((r) => r.generation + 1), [records]);
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { drag: { x: true, y: false }, points: { size: 6 } },
      scales: { x: { time: false } },
      axes: [axis('Generation'), axis('Fitness', 3)],
      series: [
        {},
        { label: 'Best', stroke: '#4c9aff', width: 2, fill: '#4c9aff14' },
        { label: 'Median', stroke: '#ff9f43', width: 1.5 },
        { label: 'Mean', stroke: '#8a94a7', width: 1, dash: [4, 4] },
      ],
      hooks: {
        draw: [
          (u: uPlot) => {
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = '#f5c45199';
            ctx.setLineDash([3, 3]);
            for (const g of markers) {
              const x = u.valToPos(g, 'x', true);
              ctx.beginPath();
              ctx.moveTo(x, u.bbox.top);
              ctx.lineTo(x, u.bbox.top + u.bbox.height);
              ctx.stroke();
            }
            ctx.restore();
          },
        ],
      },
    }),
    [markers],
  );
  const data = useMemo<uPlot.AlignedData>(
    () => [
      records.map((r) => r.generation + 1),
      records.map((r) => r.stats.best),
      records.map((r) => r.stats.median),
      records.map((r) => r.stats.mean),
    ],
    [records],
  );
  return (
    <div style={{ height }}>
      <UPlotChart options={options} data={data} className="h-full w-full" />
    </div>
  );
}
