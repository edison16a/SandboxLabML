'use client';

import { courseLines } from '@/engine/navigation/course/lines';
import type { CourseSpec } from '@/engine/navigation/course/types';
import { NAV_COLORS } from '@/render/navigation/palette';

/**
 * A course seen from above as a small SVG, start on the left and finish on
 * the right: the floor, the start zone, the finish line, crates in gold,
 * walls in light grey, spikes in red and movers in amber over the path
 * they slide along. Drawn straight from the spec, so a thumbnail never
 * builds the course.
 */
export function CourseThumb({ spec, width = 120, className }: { spec: CourseSpec; width?: number; className?: string }) {
  const hl = spec.length / 2;
  const hw = spec.width / 2;
  const pad = 0.6;
  const view = `${-hl - pad} ${-hw - pad} ${spec.length + pad * 2} ${spec.width + pad * 2}`;
  const height = (width * (spec.width + pad * 2)) / (spec.length + pad * 2);
  const { start, finish: finishX } = courseLines(spec);
  return (
    <svg viewBox={view} width={width} height={height} className={className} aria-hidden="true">
      <rect x={-hl} y={-hw} width={spec.length} height={spec.width} rx={0.8} fill={NAV_COLORS.floor} stroke={NAV_COLORS.wall} strokeWidth={0.5} />
      <rect x={-hl} y={-hw} width={start + hl} height={spec.width} fill={NAV_COLORS.startPad} opacity={0.28} />
      <rect x={finishX - 0.35} y={-hw} width={0.7} height={spec.width} fill={NAV_COLORS.checkerDark} />
      {spec.obstacles.map((o, i) => {
        if (o.kind === 'mover') {
          return (
            <g key={i}>
              <line x1={o.ax} y1={o.az} x2={o.bx} y2={o.bz} stroke={NAV_COLORS.moverTrim} strokeWidth={0.25} strokeDasharray="0.5 0.5" />
              <rect x={o.ax - o.hx} y={o.az - o.hz} width={o.hx * 2} height={o.hz * 2} rx={0.15} fill={NAV_COLORS.moverTrim} />
            </g>
          );
        }
        const fill = o.kind === 'spikes' ? NAV_COLORS.spikeTrim : o.kind === 'wall' ? '#8e949e' : NAV_COLORS.cube;
        return <rect key={i} x={o.x - o.hx} y={o.z - o.hz} width={o.hx * 2} height={o.hz * 2} rx={o.kind === 'block' ? 0.15 : 0.05} fill={fill} />;
      })}
    </svg>
  );
}
