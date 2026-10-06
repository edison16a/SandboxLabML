'use client';

import { useEffect, useRef } from 'react';
import type { GenerationRecord } from '@/engine/training/records';

function speciesCss(id: number): string {
  const hue = (((id * 0.618033988749895) % 1) + 1) % 1;
  return `hsl(${Math.round(hue * 360)} 62% 52%)`;
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
      const totals = records.map((r) => r.stats.species.reduce((s, sp) => s + sp.size, 0) || 1);
      const base = new Float64Array(n);
      for (const id of ids) {
        g.beginPath();
        for (let i = 0; i < n; i++) g.lineTo(x(i), h - (base[i] / totals[i]) * h);
        const tops = records.map((r, i) => base[i] + (r.stats.species.find((s) => s.id === id)?.size ?? 0));
        for (let i = n - 1; i >= 0; i--) g.lineTo(x(i), h - (tops[i] / totals[i]) * h);
        g.closePath();
        g.fillStyle = speciesCss(id);
        g.globalAlpha = 0.85;
        g.fill();
        tops.forEach((t, i) => (base[i] = t));
      }
      g.globalAlpha = 1;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [records]);

  return <canvas ref={ref} className="w-full rounded-md bg-surface-2" style={{ height }} aria-label="Species sizes per generation" role="img" />;
}
