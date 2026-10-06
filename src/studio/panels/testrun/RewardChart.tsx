'use client';

import { useMemo } from 'react';
import type uPlot from 'uplot';
import { axis, UPlotChart } from '@/features/charts/UPlotChart';
import type { TickLog } from './types';

/** Cumulative reward over time, the curve the brain is trying to push up. */
export function RewardChart({ log }: { log: TickLog }) {
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { points: { size: 5 } },
      scales: { x: { time: false } },
      axes: [axis('Seconds'), axis('Total reward', 3)],
      series: [{}, { label: 'Total', stroke: '#4c9aff', width: 2, fill: '#4c9aff14' }],
    }),
    [],
  );
  const data = useMemo<uPlot.AlignedData>(() => [Array.from(log.time), Array.from(log.total)], [log]);
  return (
    <div className="h-44" aria-label="Total reward over time" role="img">
      <UPlotChart options={options} data={data} className="h-full w-full" />
    </div>
  );
}
