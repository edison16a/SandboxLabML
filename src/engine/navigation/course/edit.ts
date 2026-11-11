import { courseLines } from './lines';
import { COURSE_LIMITS, courseLevel } from './sandbox';
import { INNER_WALL, type CourseSpec, type MoverSpec, type ObstacleSpec, type Rect } from './types';

/**
 * The course editor's rules. Every edit returns a new spec (so undo is a
 * stack of specs) or the reason it was refused. Positions snap to a half
 * meter grid; x runs from the start wall to the end wall, z across.
 */
export type EditResult = { spec: CourseSpec; error?: undefined } | { spec?: undefined; error: string };
export type Point = readonly [number, number];
export type BlockShape = 'small' | 'big' | 'long';

export const EDIT_GRID = 0.5;
/** Half sizes of each crate shape, m: a 1 m cube, a 1.8 m crate, and a 1 by 2.2 m one that T turns. */
export const BLOCK_SIZES: Record<BlockShape, [number, number]> = { small: [0.5, 0.5], big: [0.9, 0.9], long: [0.5, 1.1] };
/** Mover periods the editor offers, s: a full trip there and back. */
export const MOVER_PERIODS = { slow: 4.2, medium: 3.2, fast: 2.4 } as const;
export type MoverPace = keyof typeof MOVER_PERIODS;

export const snap = (v: number) => Math.round(v / EDIT_GRID) * EDIT_GRID;

/** The floor a piece takes: its box, or for a mover the whole stretch it sweeps. */
export function footprint(o: ObstacleSpec): Rect {
  if (o.kind !== 'mover') return o;
  return { x: (o.ax + o.bx) / 2, z: (o.az + o.bz) / 2, hx: Math.abs(o.bx - o.ax) / 2 + o.hx, hz: Math.abs(o.bz - o.az) / 2 + o.hz };
}

/** The topmost piece under a point, or -1. Thin walls get a little slack so a click finds them. */
export function obstacleAt(spec: CourseSpec, x: number, z: number): number {
  for (let i = spec.obstacles.length - 1; i >= 0; i--) {
    const r = footprint(spec.obstacles[i]);
    const slack = spec.obstacles[i].kind === 'wall' ? 0.15 : 0.02;
    if (Math.abs(x - r.x) <= r.hx + slack && Math.abs(z - r.z) <= r.hz + slack) return i;
  }
  return -1;
}

/** Why a piece with this footprint cannot go in, or null when it can. */
function refusal(spec: CourseSpec, r: Rect, mover: boolean, skip = -1): string | null {
  const hl = spec.length / 2;
  const hw = spec.width / 2;
  if (r.x - r.hx < -hl - 1e-9 || r.x + r.hx > hl + 1e-9 || r.z - r.hz < -hw - 1e-9 || r.z + r.hz > hw + 1e-9) return 'That reaches outside the room.';
  if (r.x - r.hx < courseLines(spec).start - 1e-9) return 'Keep the start zone clear. Runners line up there.';
  const others = spec.obstacles.filter((_, i) => i !== skip);
  if (others.length >= COURSE_LIMITS.obstacles) return `A course holds up to ${COURSE_LIMITS.obstacles} pieces.`;
  if (mover && others.filter((o) => o.kind === 'mover').length >= COURSE_LIMITS.movers) return `A course holds up to ${COURSE_LIMITS.movers} movers.`;
  return null;
}

/** The spec with its obstacles replaced, and its level read again from what it now holds. */
function withObstacles(spec: CourseSpec, obstacles: ObstacleSpec[]): CourseSpec {
  return { ...spec, obstacles, level: courseLevel({ obstacles }) };
}

function add(spec: CourseSpec, o: ObstacleSpec): EditResult {
  const error = refusal(spec, footprint(o), o.kind === 'mover');
  return error ? { error } : { spec: withObstacles(spec, [...spec.obstacles, o]) };
}

/** A crate centered on a grid point. A long crate runs across the room, or along it when turned. */
export function placeBlock(spec: CourseSpec, x: number, z: number, shape: BlockShape, turned = false): EditResult {
  const [a, b] = BLOCK_SIZES[shape];
  const [hx, hz] = turned ? [b, a] : [a, b];
  return add(spec, { kind: 'block', x: snap(x), z: snap(z), hx, hz, height: shape === 'big' ? 1.2 : 1 });
}

/** A straight wall from one grid point to another, along whichever axis the drag moved more. */
export function addWall(spec: CourseSpec, from: Point, to: Point): EditResult {
  const [ax, az] = [snap(from[0]), snap(from[1])];
  const [bx, bz] = [snap(to[0]), snap(to[1])];
  const t = INNER_WALL / 2;
  const across = Math.abs(bz - az) >= Math.abs(bx - ax);
  const len = across ? Math.abs(bz - az) : Math.abs(bx - ax);
  if (len < EDIT_GRID) return { error: 'Drag a little further to draw a wall.' };
  const rect = across ? { x: ax, z: (az + bz) / 2, hx: t, hz: len / 2 } : { x: (ax + bx) / 2, z: az, hx: len / 2, hz: t };
  return add(spec, { kind: 'wall', ...rect });
}

/** A spike pad over the rectangle between two grid points. */
export function addSpikes(spec: CourseSpec, from: Point, to: Point): EditResult {
  const [ax, az, bx, bz] = [snap(from[0]), snap(from[1]), snap(to[0]), snap(to[1])];
  const hx = Math.max(EDIT_GRID, Math.abs(bx - ax)) / 2;
  const hz = Math.max(EDIT_GRID, Math.abs(bz - az)) / 2;
  const x = ax === bx ? ax : (ax + bx) / 2;
  const z = az === bz ? az : (az + bz) / 2;
  return add(spec, { kind: 'spikes', x, z, hx, hz });
}

/** A mover sliding between two grid points, along whichever axis the drag moved more. Its crate is longer along its path. */
export function addMover(spec: CourseSpec, from: Point, to: Point, pace: MoverPace): EditResult {
  const [ax, az] = [snap(from[0]), snap(from[1])];
  const [bx, bz] = [snap(to[0]), snap(to[1])];
  const across = Math.abs(bz - az) >= Math.abs(bx - ax);
  if ((across ? Math.abs(bz - az) : Math.abs(bx - ax)) < 1) return { error: 'Drag at least 1 m to give the mover a path.' };
  const m: MoverSpec = across
    ? { kind: 'mover', hx: 0.6, hz: 0.8, height: 1, ax, az, bx: ax, bz, period: MOVER_PERIODS[pace], phase: 0 }
    : { kind: 'mover', hx: 0.8, hz: 0.6, height: 1, ax, az, bx, bz: az, period: MOVER_PERIODS[pace], phase: 0 };
  return add(spec, m);
}

/** Removes the piece under a point, or null when there is none. */
export function eraseAt(spec: CourseSpec, x: number, z: number): CourseSpec | null {
  const i = obstacleAt(spec, x, z);
  return i < 0 ? null : withObstacles(spec, spec.obstacles.filter((_, k) => k !== i));
}

/** Moves piece i by a whole number of grid steps. A mover takes its path along. */
export function moveObstacle(spec: CourseSpec, i: number, dx: number, dz: number): EditResult {
  const o = spec.obstacles[i];
  if (!o) return { error: 'Nothing to move there.' };
  const [sx, sz] = [snap(dx), snap(dz)];
  const moved: ObstacleSpec = o.kind === 'mover' ? { ...o, ax: o.ax + sx, bx: o.bx + sx, az: o.az + sz, bz: o.bz + sz } : { ...o, x: o.x + sx, z: o.z + sz };
  const error = refusal(spec, footprint(moved), false, i);
  return error ? { error } : { spec: withObstacles(spec, spec.obstacles.map((p, k) => (k === i ? moved : p))) };
}

/** Moves the start line or the finish line to x, as far as courseLines allows. The start zone must stay clear. */
export function setLine(spec: CourseSpec, line: 'start' | 'finish', x: number): EditResult {
  const lines = courseLines({ ...spec, [line]: snap(x) });
  const next = { ...spec, start: lines.start, finish: lines.finish };
  if (spec.obstacles.some((o) => footprint(o).x - footprint(o).hx < lines.start - 1e-9)) return { error: 'Clear the floor behind the new start line first.' };
  return { spec: next };
}

/** A longer or shorter room. Lines keep their distance from the walls they sit by, and pieces that no longer fit are dropped. */
export function setLength(spec: CourseSpec, length: number): CourseSpec {
  const old = courseLines(spec);
  const d = (length - spec.length) / 2;
  const lines = courseLines({ length, start: old.start - d, finish: old.finish + d });
  const resized = { ...spec, length, start: lines.start, finish: lines.finish };
  const kept = spec.obstacles
    .map((o): ObstacleSpec => (o.kind === 'mover' ? { ...o, ax: o.ax - d, bx: o.bx - d } : { ...o, x: o.x - d }))
    .filter((o) => !refusal({ ...resized, obstacles: [] }, footprint(o), false));
  return withObstacles(resized, kept);
}
