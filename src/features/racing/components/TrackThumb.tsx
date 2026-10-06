'use client';

import { useMemo } from 'react';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import type { TrackSpec } from '@/engine/racing/track/types';

/**
 * A small SVG outline of a track, used in pickers and on the Runs page.
 * Strokes are drawn at road scale but never thinner than a couple of
 * pixels, so a big track squeezed into a small tile still reads.
 */
export function TrackThumb({ spec, size = 72, className }: { spec: TrackSpec; size?: number; className?: string }) {
  const { d, view, start, perPx } = useMemo(() => {
    const t = buildTrack(spec);
    const { minX, minY, maxX, maxY } = t.bounds;
    const pad = 6;
    const pts: string[] = [];
    for (let i = 0; i < t.count; i += 4) pts.push(`${t.cx[i].toFixed(1)},${(-t.cy[i]).toFixed(1)}`);
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    return {
      d: `M${pts.join('L')}Z`,
      view: `${minX - pad} ${-maxY - pad} ${w} ${h}`,
      start: [t.cx[0], -t.cy[0]] as const,
      perPx: Math.max(w, h) / size,
    };
  }, [spec, size]);
  return (
    <svg viewBox={view} width={size} height={size} className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={Math.max(spec.width * 0.9, perPx * 5)} strokeLinejoin="round" opacity={0.18} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={Math.max(spec.width * 0.3, perPx * 1.75)} strokeLinejoin="round" />
      <circle cx={start[0]} cy={start[1]} r={Math.max(spec.width * 0.7, perPx * 2.5)} fill="#ff9f43" />
    </svg>
  );
}
