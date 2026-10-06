import { boxSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { ArenaLayout } from '@/engine/hideseek/layouts/types';

const HALF = DEFAULT_HIDESEEK_PHYSICS.arena.size / 2;

/**
 * A small map of a room seen from above: walls, where the boxes start and
 * where each team spawns (blue hiders, red seekers). Same coordinates as
 * the engine, so -z is at the top.
 */
export function LayoutThumb({ layout, size = 76, className }: { layout: ArenaLayout; size?: number; className?: string }) {
  const pad = 1;
  const view = `${-HALF - pad} ${-HALF - pad} ${2 * (HALF + pad)} ${2 * (HALF + pad)}`;
  const region = (r: ArenaLayout['hiderSpawn'], fill: string) => <rect x={r.minX} y={r.minZ} width={r.maxX - r.minX} height={r.maxZ - r.minZ} rx={0.6} fill={fill} opacity={0.35} />;
  return (
    <svg viewBox={view} width={size} height={size} className={className} aria-hidden="true">
      <rect x={-HALF} y={-HALF} width={2 * HALF} height={2 * HALF} rx={0.4} fill="currentColor" opacity={0.06} stroke="currentColor" strokeWidth={0.7} />
      {region(layout.hiderSpawn, '#4c9aff')}
      {region(layout.seekerSpawn, '#ff5f6d')}
      {layout.walls.map((w, i) => (
        <line key={i} x1={w.from[0]} y1={w.from[1]} x2={w.to[0]} y2={w.to[1]} stroke="currentColor" strokeWidth={0.6} strokeLinecap="round" />
      ))}
      {layout.boxes.map((b, i) => {
        const s = boxSize(DEFAULT_HIDESEEK_PHYSICS, i);
        return (
          <rect
            key={i}
            x={-s.length / 2}
            y={-s.width / 2}
            width={s.length}
            height={s.width}
            fill="#d2b080"
            transform={`translate(${b.x} ${b.z}) rotate(${(-b.yaw * 180) / Math.PI})`}
          />
        );
      })}
    </svg>
  );
}
