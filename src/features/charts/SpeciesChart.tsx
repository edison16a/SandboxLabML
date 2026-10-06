'use client';

import { useEffect, useRef } from 'react';
import type { GenerationRecord } from '@/engine/training/records';

function speciesCss(id: number): string {
  const hue = (((id * 0.618033988749895) % 1) + 1) % 1;
  return `hsl(${Math.round(hue * 360)} 56% 52%)`;
}

/**
 * Each species' share of the population per generation, smoothed over a
 * window that grows with the history. Members move between species from
 * one generation to the next, and with hundreds of generations squeezed
 * into a few hundred pixels that jitter drowns out the actual story: which
 * species grow, which fade and when a new one appears.
 */
export function speciesShares(records: GenerationRecord[], ids: number[]): Float64Array[] {
  const n = records.length;
  const raw = ids.map((id) =>
    Float64Array.from(records, (r) => {
      const total = r.stats.species.reduce((sum, sp) => sum + sp.size, 0) || 1;
      return (r.stats.species.find((sp) => sp.id === id)?.size ?? 0) / total;
    }),
  );
  const half = Math.floor(Math.max(1, Math.round(n / 60)) / 2);
  if (half === 0) return raw;
  return raw.map((row) =>
    Float64Array.from(row, (_, i) => {
      let sum = 0;
      let count = 0;
      for (let k = Math.max(0, i - half); k <= Math.min(n - 1, i + half); k++, count++) sum += row[k];
      return sum / count;
    }),
  );
}

/**
 * Stacked species sizes per generation, drawn on a canvas. Each band is one
 * species, in the same color its cars wear in the viewport, so a species
 * taking over the population is visible at a glance.
 */
export function SpeciesChart({ records, height = 140 }: { records: GenerationRecord[]; height?: number }) {
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
      if (records.length < 1) return;
      const ids = [...new Set(records.flatMap((r) => r.stats.species.map((s) => s.id)))].sort((a, b) => a - b);
      const n = records.length;
      const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
      const shares = speciesShares(records, ids);
      const base = new Float64Array(n);
      g.lineWidth = 0.75;
      g.strokeStyle = 'rgba(11, 14, 20, 0.55)';
      ids.forEach((id, k) => {
        const tops = Float64Array.from(base, (b, i) => b + shares[k][i]);
        g.beginPath();
        for (let i = 0; i < n; i++) g.lineTo(x(i), h - base[i] * h);
        for (let i = n - 1; i >= 0; i--) g.lineTo(x(i), h - tops[i] * h);
        g.closePath();
        g.fillStyle = speciesCss(id);
        g.globalAlpha = 0.9;
        g.fill();
        g.globalAlpha = 1;
        g.beginPath();
        for (let i = 0; i < n; i++) g.lineTo(x(i), h - tops[i] * h);
        g.stroke();
        base.set(tops);
      });
      g.globalAlpha = 1;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [records]);

  return <canvas ref={ref} className="w-full rounded-md bg-surface-2" style={{ height }} aria-label="Species sizes per generation" role="img" />;
}
