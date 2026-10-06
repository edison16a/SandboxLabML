import { boxKindSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import type { Region } from '@/engine/hideseek/layouts/types';
import { HS_COLORS } from '@/render/hideseek/palette';

const P = DEFAULT_HIDESEEK_PHYSICS;
const HALF = P.arena.size / 2;
const PAD = 0.8;
const VIEW = `${-HALF - PAD} ${-HALF - PAD} ${2 * (HALF + PAD)} ${2 * (HALF + PAD)}`;

/**
 * A small map of a room seen from above: walls, boxes by kind and where
 * each team spawns (blue hiders, red seekers). Same coordinates as the
 * engine, so -z is at the top. The New Run dialog shows the training rooms
 * with it (presetRoom turns a layout into a room) and the Sandbox picker
 * shows every room, so a room looks the same in both.
 */
export function RoomThumb({ room, size = 76, className }: { room: SandboxRoom; size?: number; className?: string }) {
  const region = (r: Region, fill: string) => <rect x={r.minX} y={r.minZ} width={r.maxX - r.minX} height={r.maxZ - r.minZ} rx={0.6} fill={fill} opacity={0.35} />;
  return (
    <svg viewBox={VIEW} width={size} height={size} className={className} aria-hidden="true">
      <rect x={-HALF} y={-HALF} width={2 * HALF} height={2 * HALF} rx={0.4} fill="currentColor" opacity={0.06} stroke="currentColor" strokeWidth={0.7} />
      {region(room.hiderSpawn, HS_COLORS.hider)}
      {region(room.seekerSpawn, HS_COLORS.seeker)}
      {room.walls.map((w, i) => (
        <line key={i} x1={w.from[0]} y1={w.from[1]} x2={w.to[0]} y2={w.to[1]} stroke="currentColor" strokeWidth={0.7} strokeLinecap="round" />
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
            fill={HS_COLORS[b.kind]}
            transform={`translate(${b.x} ${b.z}) rotate(${(-b.yaw * 180) / Math.PI})`}
          />
        );
      })}
    </svg>
  );
}
