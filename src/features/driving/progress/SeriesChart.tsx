'use client';

import { useMemo } from 'react';
import uPlot from 'uplot';
import { axis, generationAxis, UPlotChart } from '@/features/charts/UPlotChart';
import { trailingMean } from './smooth';

/** One line of a chart: its values per generation (null leaves a gap) and how it is drawn. */
export interface Series {
  label: string;
  color: string;
  values: Array<number | null>;
  dash?: number[];
  width?: number;
  /** Fill under the line with a faint wash of its color. */
  fill?: boolean;
  /** Hold each value until the next, for a level that changes in steps. */
  stepped?: boolean;
}

interface Props {
  /** Generation numbers, 1 based, one per value. */
  x: number[];
  series: Series[];
  yLabel: string;
  /** Tick text on the value axis. */
  format: (v: number) => string;
  /** Fixed value range, such as 0 to 1 for shares. */
  range?: [number, number];
  /** Fixed ticks on the value axis, such as the five levels. */
  ticks?: number[];
  /** Generations (1 based) marked with a faint dashed line, such as where the level changed. */
  marks?: number[];
  /** A faint dashed level line, such as the share that moves the curriculum up. */
  bar?: number;
  /**
   * Draw each line as the mean of the last this many generations, over its
   * raw values in a faint thin line. A new route every generation makes the
   * raw shares jump about; the mean shows the trend.
   */
  smooth?: number;
  height?: number;
}

const MARK = '#5d677966';
const BAR = '#f5c45188';
/** Holds a value until the next record. Built once, since a path builder never changes. */
const steppedPaths = uPlot.paths.stepped?.({ align: 1 });

/**
 * A per generation chart with several lines and a legend under it. Faint
 * dashed verticals can mark events (a level change), and a dashed
 * horizontal a threshold, so a newcomer sees why a line jumps.
 */
export function SeriesChart({ x, series, yLabel, format, range, ticks, marks = [], bar, smooth, height = 150 }: Props) {
  const shape = series.map((s) => `${s.label}${s.color}${s.dash ?? ''}${s.stepped ? 's' : ''}`).join('|') + (smooth ?? '');
  const markKey = marks.join(',');
  const tickKey = ticks?.join(',');
  const lo = range?.[0];
  const hi = range?.[1];
  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      cursor: { drag: { x: true, y: false }, points: { size: 6 } },
      scales: { x: { time: false }, y: range ? { range: () => range } : {} },
      axes: [generationAxis(), { ...axis(yLabel, 3), values: (_u, splits) => splits.map(format), ...(ticks && { splits: () => ticks }) }],
      series: [
        {},
        ...series.flatMap((s) => [
          ...(smooth ? [{ label: `${s.label} each generation`, stroke: `${s.color}44`, width: 1, points: { show: false } }] : []),
          {
            label: s.label,
            stroke: s.color,
            width: s.width ?? 1.75,
            dash: s.dash,
            fill: s.fill ? `${s.color}14` : undefined,
            points: { show: false },
            paths: s.stepped ? steppedPaths : undefined,
          },
        ]),
      ],
      hooks: {
        draw: [
          (u: uPlot) => {
            const ctx = u.ctx;
            ctx.save();
            ctx.setLineDash([3, 4]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = MARK;
            for (const g of marks) {
              const px = u.valToPos(g, 'x', true);
              ctx.beginPath();
              ctx.moveTo(px, u.bbox.top);
              ctx.lineTo(px, u.bbox.top + u.bbox.height);
              ctx.stroke();
            }
            if (bar !== undefined) {
              const py = u.valToPos(bar, 'y', true);
              ctx.strokeStyle = BAR;
              ctx.beginPath();
              ctx.moveTo(u.bbox.left, py);
              ctx.lineTo(u.bbox.left + u.bbox.width, py);
              ctx.stroke();
            }
            ctx.restore();
          },
        ],
      },
    }),
    // The series shape, marks and bar change the drawing; their values alone go through setData.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, yLabel, markKey, bar, lo, hi, tickKey],
  );
  const data = useMemo<uPlot.AlignedData>(() => [x, ...series.flatMap((s) => (smooth ? [s.values, trailingMean(s.values, smooth)] : [s.values]))], [x, series, smooth]);
  return (
    <div className="flex flex-col gap-1.5">
      <div style={{ height }}>
        <UPlotChart options={options} data={data} className="h-full w-full" />
      </div>
      {series.length > 1 && <Legend series={series} />}
    </div>
  );
}

/** Short colored keys for the lines, in drawing order. */
export function Legend({ series }: { series: ReadonlyArray<Pick<Series, 'label' | 'color' | 'dash'>> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      {series.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          <svg width="14" height="6" aria-hidden className="shrink-0">
            <line x1="0" y1="3" x2="14" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash?.join(' ')} />
          </svg>
          {s.label}
        </span>
      ))}
    </div>
  );
}
