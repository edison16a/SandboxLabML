import { memo } from 'react';
import type { Region } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { SandboxBox, SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { boxRect } from '@/engine/hideseek/sandbox/roomEdit';
import { HS_COLORS } from '@/render/hideseek/palette';
import { RampMark } from '../../maps/RampMark';

export const HALF = DEFAULT_HIDESEEK_PHYSICS.arena.size / 2;
const OUTER = DEFAULT_HIDESEEK_PHYSICS.arena.outerWallThickness;
const LINES = Array.from({ length: 2 * HALF + 1 }, (_, i) => i - HALF);

/** Team and crate colors come from the 3D palette, so the board, the thumbnails and the arena agree. */
export const BOARD_COLORS = {
  hider: HS_COLORS.hider,
  seeker: HS_COLORS.seeker,
  wall: '#dfe3ea',
  cube: HS_COLORS.cube,
  plank: HS_COLORS.plank,
  ramp: HS_COLORS.ramp,
  boxEdge: '#7d5f3c',
  rampEdge: '#3f6f58',
  /** The uphill chevrons: dark ink on the jade, like the crate edges. */
  rampMark: 'rgba(8, 20, 14, 0.62)',
  accent: HS_COLORS.hider,
  bad: '#ff5f5f',
};

/** The floor grid: a line every meter, stronger every five, and the outer walls round it. */
export const BoardGrid = memo(function BoardGrid() {
  return (
    <g>
      <rect x={-HALF} y={-HALF} width={2 * HALF} height={2 * HALF} fill="#121721" />
      {LINES.map((v) => {
        const major = v % 5 === 0;
        const stroke = major ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.045)';
        return (
          <g key={v}>
            <line x1={v} y1={-HALF} x2={v} y2={HALF} stroke={stroke} strokeWidth={0.04} />
            <line x1={-HALF} y1={v} x2={HALF} y2={v} stroke={stroke} strokeWidth={0.04} />
          </g>
        );
      })}
      <rect x={-HALF - OUTER / 2} y={-HALF - OUTER / 2} width={2 * HALF + OUTER} height={2 * HALF + OUTER} fill="none" stroke="#9aa3b2" strokeWidth={OUTER} />
    </g>
  );
});

/** A team's spawn area: a tinted, dashed rectangle with the team's name in one corner. */
export function SpawnArea({ region, team, preview = false }: { region: Region; team: 'hider' | 'seeker'; preview?: boolean }) {
  const color = team === 'hider' ? BOARD_COLORS.hider : BOARD_COLORS.seeker;
  return (
    <g pointerEvents="none">
      <rect
        x={region.minX}
        y={region.minZ}
        width={region.maxX - region.minX}
        height={region.maxZ - region.minZ}
        rx={0.3}
        fill={color}
        fillOpacity={preview ? 0.22 : 0.13}
        stroke={color}
        strokeOpacity={0.75}
        strokeWidth={0.07}
        strokeDasharray="0.35 0.25"
      />
      {!preview && (
        <text x={region.minX + 0.3} y={region.minZ + 0.75} fontSize={0.55} fontWeight={600} fill={color} opacity={0.9}>
          {team === 'hider' ? 'Hiders' : 'Seekers'}
        </text>
      )}
    </g>
  );
}

/**
 * One box seen from above, in its crate color, or a ramp with chevrons
 * pointing uphill. A ghost is drawn see through, red when it does not fit.
 */
export function BoardBox({ box, ghost, bad, highlight }: { box: SandboxBox; ghost?: boolean; bad?: boolean; highlight?: boolean }) {
  const fill = ghost && bad ? BOARD_COLORS.bad : BOARD_COLORS[box.kind];
  const ramp = box.kind === 'ramp';
  const edge = highlight ? BOARD_COLORS.bad : ghost ? (bad ? BOARD_COLORS.bad : '#ffffff') : ramp ? BOARD_COLORS.rampEdge : BOARD_COLORS.boxEdge;
  const edgeWidth = highlight ? 0.12 : 0.06;
  if (ramp) {
    return <RampMark ramp={box} fill={fill} fillOpacity={ghost ? 0.25 : 1} edge={edge} edgeWidth={edgeWidth} mark={ghost ? edge : BOARD_COLORS.rampMark} markWidth={0.08} chevrons={3} />;
  }
  const r = boxRect(box);
  return (
    <rect
      x={r.x - r.hx}
      y={r.z - r.hz}
      width={2 * r.hx}
      height={2 * r.hz}
      rx={0.06}
      fill={fill}
      fillOpacity={ghost ? 0.25 : 1}
      stroke={edge}
      strokeOpacity={ghost ? 0.8 : 1}
      strokeWidth={edgeWidth}
      pointerEvents="none"
    />
  );
}

/** The room as it stands: spawn areas under everything, then walls, then boxes. */
export function BoardRoom({ room, eraseWall, eraseBox, hideBox }: { room: SandboxRoom; eraseWall: number; eraseBox: number; hideBox: number }) {
  return (
    <g>
      <SpawnArea region={room.hiderSpawn} team="hider" />
      <SpawnArea region={room.seekerSpawn} team="seeker" />
      {room.walls.map((w, i) => (
        <line
          key={i}
          x1={w.from[0]}
          y1={w.from[1]}
          x2={w.to[0]}
          y2={w.to[1]}
          stroke={i === eraseWall ? BOARD_COLORS.bad : BOARD_COLORS.wall}
          strokeWidth={0.26}
          strokeLinecap="square"
          pointerEvents="none"
        />
      ))}
      {room.boxes.map((b, i) => (i === hideBox ? null : <BoardBox key={i} box={b} highlight={i === eraseBox} />))}
    </g>
  );
}
