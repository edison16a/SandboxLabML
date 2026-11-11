import { TOP_LEVEL } from './levels';
import { courseLines } from './lines';
import { MAX_COURSE_LENGTH, MAX_COURSE_WIDTH, MAX_MOVERS, type CourseSpec, type ObstacleSpec } from './types';

/** What a course drawn in the Sandbox may hold. */
export const COURSE_LIMITS = { obstacles: 48, movers: MAX_MOVERS, nameLength: 40 } as const;
/** Room lengths the editor offers, m. The width stays at 14, like every generated course. */
export const SANDBOX_LENGTHS = [30, 36, 42, 50] as const;
export const SANDBOX_WIDTH = 14;
/** Smallest half size of a piece, m, so nothing is too thin to see or to hit. */
const MIN_HALF = 0.1;

const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** One obstacle cleaned into the room, or null when it is not one. */
function cleanObstacle(o: unknown, hl: number, hw: number): ObstacleSpec | null {
  if (!isObj(o)) return null;
  const half = (v: unknown, max: number) => num(v, MIN_HALF, max, 0.5);
  if (o.kind === 'mover') {
    const hx = half(o.hx, 3);
    const hz = half(o.hz, 3);
    const end = (v: unknown, h: number, lim: number) => num(v, -lim + h, lim - h, 0);
    return { kind: 'mover', hx, hz, height: num(o.height, 0.3, 2, 1), ax: end(o.ax, hx, hl), az: end(o.az, hz, hw), bx: end(o.bx, hx, hl), bz: end(o.bz, hz, hw), period: num(o.period, 1, 12, 3), phase: num(o.phase, 0, 1, 0) };
  }
  if (o.kind !== 'block' && o.kind !== 'wall' && o.kind !== 'spikes') return null;
  const hx = half(o.hx, hl);
  const hz = half(o.hz, hw);
  const rect = { x: num(o.x, -hl + hx, hl - hx, 0), z: num(o.z, -hw + hz, hw - hz, 0), hx, hz };
  return o.kind === 'block' ? { kind: 'block', ...rect, height: num(o.height, 0.3, 2, 1) } : { kind: o.kind, ...rect };
}

/**
 * A course from storage or the editor, cleaned: sizes inside the limits,
 * every piece inside the room, at most COURSE_LIMITS of each, and the
 * start and finish lines where courseLines puts them. Null when it is not
 * a course at all, so a broken row is skipped rather than crashing.
 */
export function sanitizeCourse(v: unknown): CourseSpec | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id || !Array.isArray(v.obstacles)) return null;
  const length = Math.round(num(v.length, 20, MAX_COURSE_LENGTH, 30));
  const width = Math.round(num(v.width, 8, MAX_COURSE_WIDTH, SANDBOX_WIDTH));
  let movers = 0;
  const obstacles: ObstacleSpec[] = [];
  for (const raw of v.obstacles) {
    const o = cleanObstacle(raw, length / 2, width / 2);
    if (!o || obstacles.length >= COURSE_LIMITS.obstacles) continue;
    if (o.kind === 'mover' && ++movers > COURSE_LIMITS.movers) continue;
    obstacles.push(o);
  }
  const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim().slice(0, COURSE_LIMITS.nameLength) : 'My course';
  const lines = courseLines({ length, start: typeof v.start === 'number' ? v.start : undefined, finish: typeof v.finish === 'number' ? v.finish : undefined });
  const spec: CourseSpec = { id: v.id, name, level: 0, length, width, obstacles, start: lines.start, finish: lines.finish };
  return { ...spec, level: courseLevel(spec) };
}

/**
 * The curriculum level a drawn course reads as, for the HUD and for
 * scripts that read agent.level: the hardest kind of piece in it, and
 * the Gauntlet when it mixes walls, spikes and movers.
 */
export function courseLevel(spec: Pick<CourseSpec, 'obstacles'>): number {
  const has = (k: ObstacleSpec['kind']) => spec.obstacles.some((o) => o.kind === k);
  const blocks = spec.obstacles.filter((o) => o.kind === 'block').length;
  if (has('mover') && has('spikes') && has('wall')) return TOP_LEVEL;
  if (has('mover')) return 5;
  if (has('wall')) return 4;
  if (has('spikes')) return 3;
  return blocks >= 3 ? 2 : blocks > 0 ? 1 : 0;
}

/** An empty room to start drawing in, with the standard start and finish. */
export function emptyCourse(id: string, name: string, length = 36): CourseSpec {
  const lines = courseLines({ length });
  return { id, name, level: 0, length, width: SANDBOX_WIDTH, obstacles: [], start: lines.start, finish: lines.finish };
}
