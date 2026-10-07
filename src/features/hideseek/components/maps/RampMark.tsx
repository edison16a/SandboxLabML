import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { boxTransform, chevronPoints, rampChevrons, type Chevron } from './rampChevrons';

const RAMP = DEFAULT_HIDESEEK_PHYSICS.box.ramp;
/** Chevrons are worked out once per count: the ramp size never changes. */
const CHEVRONS = new Map<number, Chevron[]>();

function chevronsOf(count: number): Chevron[] {
  let list = CHEVRONS.get(count);
  if (!list) CHEVRONS.set(count, (list = rampChevrons(RAMP, count)));
  return list;
}

interface Props {
  /** Where the ramp stands. Its yaw points uphill, toward the lip. */
  ramp: { x: number; z: number; yaw: number };
  fill: string;
  fillOpacity?: number;
  /** Outline color and width, m. No outline when left out. */
  edge?: string;
  edgeWidth?: number;
  /** Chevron color and stroke width, m. */
  mark: string;
  markWidth: number;
  /** How many chevrons: three on the editor board, one on a small thumbnail. */
  chevrons: number;
}

/**
 * A ramp on a 2D room map: its footprint with chevrons pointing uphill
 * and a heavier line along the lip, its high end. Every map draws ramps
 * with this, so the editor board and the thumbnails agree with each other
 * and with the 3D room, where the yaw points uphill the same way.
 */
export function RampMark({ ramp, fill, fillOpacity = 1, edge, edgeWidth = 0, mark, markWidth, chevrons }: Props) {
  const hx = RAMP.length / 2;
  const hz = RAMP.width / 2;
  return (
    <g transform={boxTransform(ramp)} pointerEvents="none">
      <rect x={-hx} y={-hz} width={2 * hx} height={2 * hz} rx={Math.min(0.06, hz / 4)} fill={fill} fillOpacity={fillOpacity} stroke={edge} strokeWidth={edge ? edgeWidth : 0} />
      <line x1={hx - markWidth} y1={-hz + markWidth} x2={hx - markWidth} y2={hz - markWidth} stroke={mark} strokeWidth={markWidth * 1.4} strokeLinecap="round" />
      {chevronsOf(chevrons).map((c, i) => (
        <polyline key={i} points={chevronPoints(c)} fill="none" stroke={mark} strokeWidth={markWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
}
