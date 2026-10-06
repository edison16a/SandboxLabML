'use client';

import { useEffect, useRef } from 'react';
import type { GenerationStats } from '@/engine/neat/stats';

/** Species colors share the hue of their team, spread in lightness and a little in hue so neighbors differ. */
function bandColor(id: number, hue: number): string {
  const t = (((id * 0.618033988749895) % 1) + 1) % 1;
  return `hsl(${Math.round(hue + (t - 0.5) * 40)} ${55 + Math.round(t * 25)}% ${36 + Math.round(t * 30)}%)`;
}

/**
 * Stacked species sizes of one team per generation. Bands use the team's
 * own hue family, so hider and seeker charts never look alike.
 */
export function SpeciesBands({ stats, hue, height = 72, label }: { stats: GenerationStats[]; hue: number; height?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const g = canvas.getContext('2d');
      if (!g) return;
      g.scale(dpr, dpr);
      g.clearRect(0, 0, w, h);
      if (stats.length < 1) return;
      // A single generation is drawn as a flat stack across the full width.
      const series = stats.length === 1 ? [stats[0], stats[0]] : stats;
      const n = series.length;
      const ids = [...new Set(series.flatMap((s) => s.species.map((sp) => sp.id)))].sort((a, b) => a - b);
      const x = (i: number) => (i / (n - 1)) * w;
      const totals = series.map((s) => s.species.reduce((sum, sp) => sum + sp.size, 0) || 1);
      const base = new Float64Array(n);
      for (const id of ids) {
        g.beginPath();
        for (let i = 0; i < n; i++) g.lineTo(x(i), h - (base[i] / totals[i]) * h);
        const tops = series.map((s, i) => base[i] + (s.species.find((sp) => sp.id === id)?.size ?? 0));
        for (let i = n - 1; i >= 0; i--) g.lineTo(x(i), h - (tops[i] / totals[i]) * h);
        g.closePath();
        g.fillStyle = bandColor(id, hue);
        g.fill();
        tops.forEach((t, i) => (base[i] = t));
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [stats, hue]);
  return <canvas ref={ref} className="w-full rounded-md bg-surface-2" style={{ height }} aria-label={label} role="img" />;
}
