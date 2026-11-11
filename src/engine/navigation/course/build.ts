import { DEFAULT_NAVIGATION_PARAMS, type NavigationParams } from '../params';
import { buildField, type DistanceField } from './field';
import { sampleDistance } from './fieldSample';
import { startFormation, startLineX, type StartFormation } from './formation';
import { MOVER_SPEED_LIMIT } from './movers';
import { FINISH_INSET, MAX_MOVERS, OUTER_WALL, type CourseSpec, type MoverSpec, type Rect } from './types';

/**
 * A course ready to run: the spec plus everything derived from it once,
 * so a tick only reads flat arrays. Rect data is packed as x, z, hx, hz.
 */
export interface Course {
  spec: CourseSpec;
  halfLength: number;
  halfWidth: number;
  /** The start line's x, and its middle across the room (0). Agents line up behind it, facing +x. */
  startX: number;
  startZ: number;
  /** The start grid behind the line. */
  formation: StartFormation;
  /** Agents finish once their center crosses this x. */
  finishX: number;
  /** Every static solid: the four outer walls first, then inner walls and blocks. */
  solids: Rect[];
  solidData: Float64Array;
  spikes: Rect[];
  spikeData: Float64Array;
  /** The movers as they run: at most MAX_MOVERS, none faster than MOVER_SPEED_LIMIT (see runnableMover). */
  movers: MoverSpec[];
  field: DistanceField;
  /** Walking distance from the middle of the start line to the finish, m: the yardstick that compares agents (see NavAgent.courseProgress). */
  startDistance: number;
  /** Episode length, s: room for a slow, careful walk with waits at every mover, and a margin. */
  timeLimit: number;
}

/** Grid cell of the distance field, m. Fine enough for the narrowest gap a level makes. */
export const FIELD_CELL = 0.25;
/** Extra clearance the field keeps from solids and from spikes on top of the agent radius, m. The path hint keeps clear by that much. */
export const SOLID_CLEARANCE = 0.12;
export const SPIKE_CLEARANCE = 0.3;

/** The four outer walls round a room of the spec's size. */
export function outerWalls(spec: Pick<CourseSpec, 'length' | 'width'>): Rect[] {
  const hl = spec.length / 2;
  const hw = spec.width / 2;
  const t = OUTER_WALL / 2;
  return [
    { x: 0, z: -hw - t, hx: hl + OUTER_WALL, hz: t },
    { x: 0, z: hw + t, hx: hl + OUTER_WALL, hz: t },
    { x: -hl - t, z: 0, hx: t, hz: hw },
    { x: hl + t, z: 0, hx: t, hz: hw },
  ];
}

/**
 * A mover as the course runs it. One faster than MOVER_SPEED_LIMIT could
 * pass through an agent between two pushes, so its period is stretched
 * until it is not; it keeps its path and phase. A bad period (zero, or
 * not a number) gets the slowest safe one. Specs from the Sandbox or a
 * script go through here, so the physics never meets a mover it cannot
 * handle.
 */
export function runnableMover(m: MoverSpec): MoverSpec {
  // Top speed is pi * travel / (2 * period), so this is the shortest period within the limit.
  const shortest = (Math.PI * Math.hypot(m.bx - m.ax, m.bz - m.az)) / (2 * MOVER_SPEED_LIMIT);
  if (!Number.isFinite(m.period) || m.period <= 0) return { ...m, period: Math.max(1, shortest) };
  return m.period < shortest ? { ...m, period: shortest } : m;
}

function pack(rects: readonly Rect[]): Float64Array {
  const out = new Float64Array(rects.length * 4);
  rects.forEach((r, i) => out.set([r.x, r.z, r.hx, r.hz], i * 4));
  return out;
}

/** Builds a course from its spec. Deterministic: the same spec always gives the same course. */
export function buildCourse(spec: CourseSpec, params: NavigationParams = DEFAULT_NAVIGATION_PARAMS): Course {
  const halfLength = spec.length / 2;
  const halfWidth = spec.width / 2;
  const startX = startLineX(spec.length);
  const finishX = halfLength - FINISH_INSET;
  const inner: Rect[] = [];
  const spikes: Rect[] = [];
  const movers: MoverSpec[] = [];
  for (const o of spec.obstacles) {
    if (o.kind === 'spikes') spikes.push({ x: o.x, z: o.z, hx: o.hx, hz: o.hz });
    // The world block streams MAX_MOVERS movers at most; any past that are left out.
    else if (o.kind === 'mover') {
      if (movers.length < MAX_MOVERS) movers.push(runnableMover(o));
    }
    else inner.push({ x: o.x, z: o.z, hx: o.hx, hz: o.hz });
  }
  const r = params.agent.radius;
  const field = buildField({
    length: spec.length,
    width: spec.width,
    finishX,
    solids: inner,
    spikes,
    solidMargin: r + SOLID_CLEARANCE,
    spikeMargin: r + SPIKE_CLEARANCE,
    cell: FIELD_CELL,
  });
  const solids = [...outerWalls(spec), ...inner];
  const startDistance = sampleDistance(field, startX, 0);
  // An unsolvable spec still gets a finite clock, so an env built from it ends.
  const walk = Number.isFinite(startDistance) ? startDistance : spec.length * 2;
  // One and a half times the walk at half speed, and a full mover cycle or so for each mover to wait out.
  const timeLimit = Math.round((1.5 * walk) / (params.agent.maxSpeed * 0.5) + 6 + movers.length * 2.5);
  return {
    spec,
    halfLength,
    halfWidth,
    startX,
    startZ: 0,
    formation: startFormation(startX, spec.width, spec.length, params),
    finishX,
    solids,
    solidData: pack(solids),
    spikes,
    spikeData: pack(spikes),
    movers,
    field,
    startDistance,
    timeLimit,
  };
}

/** Whether an agent can walk from the start line to the finish with clearance to spare (movers aside: they are timed, not walked round). */
export function isSolvable(course: Course): boolean {
  return Number.isFinite(course.startDistance) && course.startDistance < course.spec.length * 3;
}
