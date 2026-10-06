import { boxKindSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import type { Region } from '@/engine/hideseek/layouts/types';

const HALF = DEFAULT_HIDESEEK_PHYSICS.arena.size / 2;
const P = DEFAULT_HIDESEEK_PHYSICS;

/**
 * A small map of a Sandbox room seen from above: walls, boxes by kind and
 * where each team spawns. Same coordinates as the engine, so -z is at the
 * top, like LayoutThumb for the training rooms.
 */
export function RoomThumb({ room, size = 56, className }: { room: SandboxRoom; size?: number; className?: string }) {
  const pad = 0.8;
  const view = `${-HALF - pad} ${-HALF - pad} ${2 * (HALF + pad)} ${2 * (HALF + pad)}`;
  const region = (r: Region, fill: string) => <rect x={r.minX} y={r.minZ} width={r.maxX - r.minX} height={r.maxZ - r.minZ} rx={0.5} fill={fill} opacity={0.38} />;
  return (
    <svg viewBox={view} width={size} height={size} className={className} aria-hidden="true">
      <rect x={-HALF} y={-HALF} width={2 * HALF} height={2 * HALF} rx={0.4} fill="currentColor" opacity={0.06} stroke="currentColor" strokeWidth={0.7} />
      {region(room.hiderSpawn, '#4c9aff')}
      {region(room.seekerSpawn, '#ff5f6d')}
      {room.walls.map((w, i) => (
        <line key={i} x1={w.from[0]} y1={w.from[1]} x2={w.to[0]} y2={w.to[1]} stroke="currentColor" strokeWidth={0.7} strokeLinecap="square" />
      ))}
      {room.boxes.map((b, i) => {
        const s = boxKindSize(P, b.kind);
        return (
          <rect
            key={i}
            x={-s.length / 2}
            y={-s.width / 2}
            width={s.length}
            height={s.width}
            fill={b.kind === 'cube' ? '#d2b080' : '#c09a6b'}
            transform={`translate(${b.x} ${b.z}) rotate(${(-b.yaw * 180) / Math.PI})`}
          />
        );
      })}
    </svg>
  );
}
