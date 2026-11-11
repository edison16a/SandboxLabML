'use client';

import { useMemo } from 'react';
import uPlot from 'uplot';
import { NAV_LEVELS, TOP_LEVEL } from '@/engine/navigation/course/levels';
import { NAV_METRIC } from '@/engine/navigation/pipeline/metricSpecs';
import type { GenerationRecord } from '@/engine/training/records';
import { axis, generationAxis, UPlotChart } from '@/features/charts/UPlotChart';

const LINE = '#4c9aff';
const steps = uPlot.paths.stepped?.({ align: 1 });

/** Generation of each record and the level it ran, as chart columns. */
function levelColumns(records: readonly GenerationRecord[]): uPlot.AlignedData {
  return [records.map((r) => r.generation + 1), records.map((r) => r.metrics?.[NAV_METRIC.level] ?? null)];
}

/**
 * Writes each level's name where its stretch of the line begins, when the
 * stretch is wide enough to hold it, so the timeline reads as "Straight
 * run, One block, Block field" rather than as bare numbers.
 */
function drawNames(u: uPlot): void {
  const xs = u.data[0];
  const ys = u.data[1];
  const ctx = u.ctx;
  ctx.save();
  ctx.font = `${10 * devicePixelRatio}px var(--font-geist-sans)`;
  ctx.fillStyle = '#8a94a7';
  ctx.textBaseline = 'bottom';
  let start = 0;
  for (let i = 1; i <= xs.length; i++) {
    if (i < xs.length && ys[i] === ys[start]) continue;
    const level = ys[start];
    if (typeof level === 'number') {
      const left = u.valToPos(xs[start], 'x', true);
      const right = i < xs.length ? u.valToPos(xs[i], 'x', true) : u.bbox.left + u.bbox.width;
      const name = NAV_LEVELS[level]?.name ?? '';
      const y = u.valToPos(level, 'y', true) - 4 * devicePixelRatio;
      if (ctx.measureText(name).width + 6 * devicePixelRatio < right - left) ctx.fillText(name, left + 3 * devicePixelRatio, y);
    }
    start = i;
  }
  ctx.restore();
}

/** The curriculum level per generation as a step line, each stretch named after its level. */
export function LevelChart({ records, height = 140 }: { records: GenerationRecord[]; height?: number }) {
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { drag: { x: true, y: false }, points: { size: 6 } },
      scales: { x: { time: false }, y: { range: [0, TOP_LEVEL + 0.8] } },
      axes: [generationAxis(), { ...axis('Level', 3), splits: () => NAV_LEVELS.map((l) => l.level), values: (_u, splits) => splits.map((v) => String(v)) }],
      series: [{}, { label: 'Level', stroke: LINE, width: 2, fill: `${LINE}1a`, paths: steps, points: { size: 5 } }],
      hooks: { draw: [drawNames] },
    }),
    [],
  );
  const data = useMemo(() => levelColumns(records), [records]);
  return (
    <div style={{ height }}>
      <UPlotChart options={options} data={data} className="h-full w-full" />
    </div>
  );
}
