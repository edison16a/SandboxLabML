'use client';

import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface Props {
  options: Omit<uPlot.Options, 'width' | 'height'>;
  data: uPlot.AlignedData;
  className?: string;
  /** Called with the plot so callers can wire hover sync. */
  onReady?: (plot: uPlot) => void;
}

/**
 * Thin React wrapper around uPlot. The plot is created once per options
 * object and resized with its container; new data is pushed with setData,
 * which is cheap enough to call every generation.
 */
export function UPlotChart({ options, data, className, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const p = new uPlot({ ...options, width: el.clientWidth || 300, height: el.clientHeight || 160 }, data, el);
    plot.current = p;
    onReady?.(p);
    const ro = new ResizeObserver(() => p.setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      p.destroy();
      plot.current = null;
    };
    // Data is applied in the next effect; recreating on every data change would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  useEffect(() => {
    plot.current?.setData(data);
  }, [data]);

  return <div ref={host} className={className} />;
}

/** Tick steps for a generation axis: whole numbers only, since there is no generation 1.5. */
const GENERATION_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

/** The x axis of every per generation chart, ticked at whole generations only. */
export function generationAxis(): uPlot.Axis {
  return { ...axis('Generation'), incrs: GENERATION_STEPS };
}

/** Axis styling shared by every chart. */
export function axis(label?: string, side: 0 | 1 | 2 | 3 = 2): uPlot.Axis {
  return {
    side,
    label,
    stroke: '#8a94a7',
    labelFont: '11px var(--font-geist-sans)',
    font: '10px var(--font-geist-mono)',
    grid: { stroke: '#232a37', width: 1 },
    ticks: { stroke: '#232a37', width: 1, size: 4 },
    size: side === 3 ? 44 : 30,
    labelSize: 16,
  };
}
