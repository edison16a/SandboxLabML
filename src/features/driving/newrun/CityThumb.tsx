'use client';

import { useMemo } from 'react';
import type { CitySpec } from '@/engine/driving/city/types';

/** Street width drawn in the thumbnail, as a share of the smallest block. */
const STREET = 0.16;

/**
 * A small plan of a city: its blocks as rounded tiles between the streets,
 * slow zones as a dashed line down their street. Drawn straight from the
 * spec, so the tile shows the real block sizes.
 */
export function CityThumb({ spec, size = 64, className }: { spec: CitySpec; size?: number; className?: string }) {
  const plan = useMemo(() => {
    const width = spec.columns.reduce((a, b) => a + b, 0);
    const depth = spec.rows.reduce((a, b) => a + b, 0);
    const street = Math.min(...spec.columns, ...spec.rows) * STREET;
    const blocks: Array<{ x: number; y: number; w: number; h: number }> = [];
    let y = 0;
    for (const r of spec.rows) {
      let x = 0;
      for (const c of spec.columns) {
        blocks.push({ x: x + street / 2, y: y + street / 2, w: c - street, h: r - street });
        x += c;
      }
      y += r;
    }
    const lines = (sizes: number[], at: number[]) => at.filter((k) => k >= 0 && k <= sizes.length).map((k) => sizes.slice(0, k).reduce((a, b) => a + b, 0));
    return { width, depth, street, blocks, slowX: lines(spec.columns, spec.slow?.vertical ?? []), slowY: lines(spec.rows, spec.slow?.horizontal ?? []) };
  }, [spec]);
  const pad = plan.street;
  return (
    <svg viewBox={`${-pad} ${-pad} ${plan.width + pad * 2} ${plan.depth + pad * 2}`} width={size} height={size} className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {plan.blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={plan.street * 0.5} fill="currentColor" opacity={0.28} />
      ))}
      {plan.slowX.map((x) => (
        <line key={`x${x}`} x1={x} y1={0} x2={x} y2={plan.depth} stroke="#ff9f43" strokeWidth={plan.street * 0.35} strokeDasharray={`${plan.street} ${plan.street}`} />
      ))}
      {plan.slowY.map((y) => (
        <line key={`y${y}`} x1={0} y1={y} x2={plan.width} y2={y} stroke="#ff9f43" strokeWidth={plan.street * 0.35} strokeDasharray={`${plan.street} ${plan.street}`} />
      ))}
      <rect x={-pad / 2} y={-pad / 2} width={plan.width + pad} height={plan.depth + pad} rx={plan.street} fill="none" stroke="currentColor" strokeWidth={plan.street * 0.3} opacity={0.5} />
    </svg>
  );
}
