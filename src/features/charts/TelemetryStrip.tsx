'use client';

import { useEffect, useMemo, useRef } from 'react';
import type uPlot from 'uplot';
import { useRacingLab } from '@/features/racing/state/labStore';
import type { GhostTelemetry } from '@/workers/replay/ghostPlayer';
import { ghostCss } from './ghostCss';
import { axis, UPlotChart } from './UPlotChart';

const STEP = 2;

/** Resamples each ghost's speed onto one shared distance grid so uPlot can align them. */
function align(telemetry: GhostTelemetry[]): uPlot.AlignedData {
  const maxD = Math.max(10, ...telemetry.map((t) => t.distance[t.distance.length - 1] ?? 0));
  const xs: number[] = [];
  for (let d = 0; d <= maxD; d += STEP) xs.push(d);
  const series = telemetry.map((t) => {
    const out: Array<number | null> = new Array(xs.length).fill(null);
    let k = 0;
    xs.forEach((d, i) => {
      while (k < t.distance.length - 1 && t.distance[k + 1] < d) k++;
      if (t.distance.length && d <= t.distance[t.distance.length - 1] && d >= 0) out[i] = t.speed[k] * 3.6;
    });
    return out;
  });
  return [xs, ...series] as uPlot.AlignedData;
}

/**
 * Speed against distance for every ghost. Braking points show up as dips,
 * and over generations the dips move later and shallower. Hovering a line
 * highlights that ghost in 3D, and hovering a ghost highlights its line.
 */
export function TelemetryStrip() {
  const telemetry = useRacingLab((s) => s.telemetry);
  const hovered = useRacingLab((s) => s.hoveredGhost);
  const plot = useRef<uPlot | null>(null);
  const gens = useMemo(() => telemetry.map((t) => t.generation), [telemetry]);

  const options = useMemo<Omit<uPlot.Options, 'width' | 'height'>>(
    () => ({
      legend: { show: false },
      focus: { alpha: 0.25 },
      cursor: { focus: { prox: 12 }, points: { show: false }, drag: { x: false, y: false } },
      scales: { x: { time: false } },
      axes: [axis('Distance (m)'), axis('km/h', 3)],
      series: [
        {},
        ...gens.map((g, i) => ({ label: `Gen ${g + 1}`, stroke: ghostCss(gens.length > 1 ? i / (gens.length - 1) : 1), width: i === gens.length - 1 ? 2 : 1.25, spanGaps: false })),
      ],
      hooks: {
        setSeries: [
          (_u: uPlot, idx: number | null) => {
            const gen = idx ? gens[idx - 1] : null;
            if (useRacingLab.getState().hoveredGhost !== gen) useRacingLab.getState().set({ hoveredGhost: gen ?? null });
          },
        ],
      },
    }),
    [gens],
  );
  const data = useMemo(() => align(telemetry), [telemetry]);

  useEffect(() => {
    const p = plot.current;
    if (!p) return;
    const idx = hovered === null ? -1 : gens.indexOf(hovered);
    if (idx >= 0) p.setSeries(idx + 1, { focus: true }, false);
  }, [hovered, gens]);

  if (!telemetry.length) {
    return <div className="flex h-full items-center justify-center text-[12px] text-subtle">Speed traces appear after the first generation.</div>;
  }
  return <UPlotChart options={options} data={data} className="h-full w-full" onReady={(p) => (plot.current = p)} />;
}
