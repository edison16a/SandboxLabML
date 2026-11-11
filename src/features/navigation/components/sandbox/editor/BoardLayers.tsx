import { memo } from 'react';
import { courseLines } from '@/engine/navigation/course/lines';
import { OUTER_WALL, type CourseSpec, type ObstacleSpec } from '@/engine/navigation/course/types';
import { NAV_COLORS } from '@/render/navigation/palette';

/** The board's colors: a dark floor for the dialog, and the 3D scene's crate, spike and mover colors so the board and the room agree. */
export const BOARD = {
  floor: '#121721',
  grid: 'rgba(255,255,255,0.05)',
  gridMajor: 'rgba(255,255,255,0.12)',
  wall: '#dfe3ea',
  outer: '#9aa3b2',
  block: NAV_COLORS.cube,
  blockEdge: '#7d5f3c',
  spikes: NAV_COLORS.spikeTrim,
  spikeDot: 'rgba(255, 236, 238, 0.8)',
  mover: NAV_COLORS.moverTrim,
  moverEdge: '#8a5a00',
  start: NAV_COLORS.startPad,
  accent: '#4c9aff',
  bad: '#ff5f5f',
  checkerDark: '#0b0e14',
  checkerLight: '#e8ecf2',
};

/** The floor grid: a line every meter, stronger every five, and the outer walls round it. */
export const BoardGrid = memo(function BoardGrid({ length, width }: { length: number; width: number }) {
  const hl = length / 2;
  const hw = width / 2;
  const xs = Array.from({ length: length + 1 }, (_, i) => i - hl);
  const zs = Array.from({ length: width + 1 }, (_, i) => i - hw);
  return (
    <g pointerEvents="none">
      <rect x={-hl} y={-hw} width={length} height={width} fill={BOARD.floor} />
      {xs.map((x) => (
        <line key={`x${x}`} x1={x} y1={-hw} x2={x} y2={hw} stroke={Math.round(x + hl) % 5 === 0 ? BOARD.gridMajor : BOARD.grid} strokeWidth={0.04} />
      ))}
      {zs.map((z) => (
        <line key={`z${z}`} x1={-hl} y1={z} x2={hl} y2={z} stroke={Math.round(z + hw) % 5 === 0 ? BOARD.gridMajor : BOARD.grid} strokeWidth={0.04} />
      ))}
      <rect x={-hl - OUTER_WALL / 2} y={-hw - OUTER_WALL / 2} width={length + OUTER_WALL} height={width + OUTER_WALL} fill="none" stroke={BOARD.outer} strokeWidth={OUTER_WALL} />
    </g>
  );
});

/** The start zone behind its line, tinted blue, and a checkered finish line. */
export function BoardLines({ spec, preview }: { spec: CourseSpec; preview?: { line: 'start' | 'finish'; x: number } | null }) {
  const hl = spec.length / 2;
  const hw = spec.width / 2;
  const lines = courseLines(spec);
  const start = preview?.line === 'start' ? preview.x : lines.start;
  const finish = preview?.line === 'finish' ? preview.x : lines.finish;
  const cells = Math.ceil(spec.width / 0.5);
  return (
    <g pointerEvents="none">
      <rect x={-hl} y={-hw} width={start + hl} height={spec.width} fill={BOARD.start} fillOpacity={0.16} />
      <line x1={start} y1={-hw} x2={start} y2={hw} stroke={BOARD.start} strokeWidth={0.12} />
      <text x={-hl + 0.4} y={-hw + 0.9} fontSize={0.6} fontWeight={600} fill={BOARD.start}>
        Start
      </text>
      {Array.from({ length: cells }, (_, k) =>
        [0, 1].map((col) => <rect key={`${k}-${col}`} x={finish - 0.5 + col * 0.5} y={-hw + k * 0.5} width={0.5} height={Math.min(0.5, spec.width - k * 0.5)} fill={(k + col) % 2 === 0 ? BOARD.checkerLight : BOARD.checkerDark} />),
      )}
      <text x={finish + 0.4} y={-hw + 0.9} fontSize={0.6} fontWeight={600} fill={BOARD.checkerLight} opacity={0.85}>
        Finish
      </text>
    </g>
  );
}

/**
 * One piece seen from above: a crate in gold, a wall in light grey, a
 * spike pad in red with its points, a mover in amber over the dashed path
 * it slides along. A ghost is drawn see through, red when it does not fit.
 */
export function BoardPiece({ o, ghost, bad, highlight }: { o: ObstacleSpec; ghost?: boolean; bad?: boolean; highlight?: boolean }) {
  const opacity = ghost ? 0.35 : 1;
  const edge = highlight || (ghost && bad) ? BOARD.bad : ghost ? '#ffffff' : undefined;
  if (o.kind === 'mover') {
    return (
      <g pointerEvents="none" opacity={ghost ? 0.6 : 1}>
        <line x1={o.ax} y1={o.az} x2={o.bx} y2={o.bz} stroke={BOARD.mover} strokeOpacity={0.6} strokeWidth={0.14} strokeDasharray="0.4 0.3" />
        <rect x={o.bx - o.hx} y={o.bz - o.hz} width={o.hx * 2} height={o.hz * 2} rx={0.12} fill="none" stroke={BOARD.mover} strokeOpacity={0.55} strokeWidth={0.06} strokeDasharray="0.2 0.15" />
        <rect x={o.ax - o.hx} y={o.az - o.hz} width={o.hx * 2} height={o.hz * 2} rx={0.12} fill={bad ? BOARD.bad : BOARD.mover} stroke={edge ?? BOARD.moverEdge} strokeWidth={highlight ? 0.12 : 0.06} />
      </g>
    );
  }
  const fill = ghost && bad ? BOARD.bad : o.kind === 'block' ? BOARD.block : o.kind === 'wall' ? BOARD.wall : BOARD.spikes;
  const dots: Array<[number, number]> = [];
  if (o.kind === 'spikes' && !ghost) for (let x = o.x - o.hx + 0.25; x < o.x + o.hx; x += 0.5) for (let z = o.z - o.hz + 0.25; z < o.z + o.hz; z += 0.5) dots.push([x, z]);
  return (
    <g pointerEvents="none">
      <rect x={o.x - o.hx} y={o.z - o.hz} width={o.hx * 2} height={o.hz * 2} rx={o.kind === 'block' ? 0.08 : 0.04} fill={fill} fillOpacity={opacity} stroke={edge ?? (o.kind === 'block' ? BOARD.blockEdge : 'none')} strokeWidth={highlight ? 0.12 : 0.06} />
      {dots.map(([x, z], i) => (
        <circle key={i} cx={x} cy={z} r={0.07} fill={BOARD.spikeDot} />
      ))}
    </g>
  );
}

/** Every piece as it stands, spikes under walls and crates, so nothing hides what blocks the way. */
export function BoardPieces({ spec, highlight, hide }: { spec: CourseSpec; highlight: number; hide: number }) {
  const order = spec.obstacles.map((o, i) => ({ o, i })).sort((a, b) => Number(a.o.kind !== 'spikes') - Number(b.o.kind !== 'spikes'));
  return <g>{order.map(({ o, i }) => (i === hide ? null : <BoardPiece key={i} o={o} highlight={i === highlight} />))}</g>;
}
