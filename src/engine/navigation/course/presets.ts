import type { BlockSpec, CourseSpec, MoverSpec, SpikesSpec, WallSpec } from './types';

const W = 14;
const T = 0.15;

const block = (x: number, z: number, hx: number, hz: number, height = 1): BlockSpec => ({ kind: 'block', x, z, hx, hz, height });
const spikes = (x: number, z: number, hx: number, hz: number): SpikesSpec => ({ kind: 'spikes', x, z, hx, hz });
/** A wall across the room at x from z0 to z1. */
const wall = (x: number, z0: number, z1: number): WallSpec => ({ kind: 'wall', x, z: (z0 + z1) / 2, hx: T, hz: (z1 - z0) / 2 });
/** A mover at x sliding across the room between z0 and z1. */
const slider = (x: number, z0: number, z1: number, hz: number, period: number, phase: number): MoverSpec => ({ kind: 'mover', hx: 0.6, hz, height: 1, ax: x, az: z0, bx: x, bz: z1, period, phase });

/**
 * Hand made courses with names, one per level, for lessons, tests and the
 * Sandbox. Two more (marked heldOut) never appear in training, so the
 * benchmark can ask a champion to navigate rooms it has never seen.
 */
export const NAMED_COURSES: ReadonlyArray<CourseSpec & { heldOut?: boolean }> = [
  { id: 'first-steps', name: 'First steps', level: 0, length: 28, width: W, obstacles: [] },
  { id: 'the-pillar', name: 'The pillar', level: 1, length: 30, width: W, obstacles: [block(1, 0.3, 1, 2.2, 1.2)] },
  {
    id: 'crate-yard',
    name: 'Crate yard',
    level: 2,
    length: 36,
    width: W,
    obstacles: [block(-7, -2.5, 0.5, 0.5), block(-6, 2, 0.65, 0.65, 1.2), block(-3, 0, 0.5, 1.1), block(0, -4, 0.9, 0.9, 1.2), block(1, 3.5, 1.1, 0.5), block(4, -1, 0.65, 0.65, 1.2), block(6.5, 2.5, 0.5, 1.1), block(9, -3, 0.9, 0.9, 1.2), block(10.5, 1, 0.5, 0.5)],
  },
  {
    id: 'spike-alley',
    name: 'Spike alley',
    level: 3,
    length: 38,
    width: W,
    obstacles: [spikes(-7, -3.7, 0.8, 3.1), spikes(-7, 4.1, 0.8, 2.7), spikes(1, -2.4, 0.9, 4.4), spikes(1, 5.5, 0.9, 1.3), spikes(9, 1.1, 0.8, 5.7), block(-3, 3, 0.65, 0.65, 1.2), block(5, -3.5, 0.5, 0.5)],
  },
  {
    id: 'zigzag',
    name: 'Zigzag',
    level: 4,
    length: 42,
    width: W,
    obstacles: [wall(-8, -7, 3), wall(-8, 5, 7), wall(1, -7, -5), wall(1, -3, 7), wall(10, -7, 2.5), wall(10, 4.5, 7), block(-3.5, -2, 0.5, 0.5), block(5.5, 3, 0.65, 0.65, 1.2)],
  },
  {
    id: 'piston-row',
    name: 'Piston row',
    level: 5,
    length: 42,
    width: W,
    obstacles: [wall(-7, -7, -3), wall(-7, 2, 7), slider(-7, -2.12, 1.12, 0.8, 2.8, 0), slider(1, -2.6, 2.6, 0.9, 4.2, 0.5), wall(9, -7, 0), wall(9, 5, 7), slider(9, 0.88, 4.12, 0.8, 2.8, 0.25)],
  },
  {
    id: 'gauntlet',
    name: 'Gauntlet',
    level: 6,
    length: 50,
    width: W,
    obstacles: [
      block(-14, -2.5, 0.5, 0.5),
      block(-12.5, 2.5, 0.65, 0.65, 1.2),
      block(-11, 0, 0.5, 1.1),
      spikes(-6, -3.9, 0.8, 2.9),
      spikes(-6, 3.9, 0.8, 2.9),
      wall(1, -7, 3),
      wall(1, 5, 7),
      wall(8, -7, -4),
      wall(8, 1, 7),
      slider(8, -3.12, 0.12, 0.8, 2.6, 0.3),
      slider(15, -2.5, 2.5, 0.9, 4, 0.7),
      spikes(18.5, -5, 0.6, 1.2),
      spikes(18.5, 5, 0.6, 1.2),
    ],
  },
  {
    id: 'switchback',
    name: 'Switchback',
    level: 4,
    length: 42,
    width: W,
    heldOut: true,
    obstacles: [wall(-8, -5, 7), wall(-1, -7, 5), spikes(-4.5, 0, 0.7, 1.4), wall(6, -5, 7), spikes(2.5, -5.4, 0.6, 1.2), block(11, 0, 0.9, 0.9, 1.2), spikes(14, 4.5, 0.7, 2.1)],
  },
  {
    id: 'clockwork',
    name: 'Clockwork',
    level: 5,
    length: 46,
    width: W,
    heldOut: true,
    obstacles: [
      block(-11, 3, 0.65, 0.65, 1.2),
      slider(-5, -4.2, 0.2, 0.9, 3.4, 0.1),
      slider(-5, 2.6, 5.9, 0.8, 3, 0.6),
      wall(2, -7, -1.5),
      wall(2, 3.5, 7),
      slider(2, -0.62, 2.62, 0.8, 2.6, 0.4),
      spikes(7.5, 0, 0.6, 2),
      slider(13, -3, 3, 0.9, 4.4, 0.85),
    ],
  },
];

export function namedCourse(id: string): CourseSpec | undefined {
  return NAMED_COURSES.find((c) => c.id === id);
}

/** The named courses a run may train on: all but the benchmark's held out rooms. */
export const TRAINING_COURSES = NAMED_COURSES.filter((c) => !c.heldOut);

/**
 * A named course a run may train on, or undefined for a held out one (or
 * an unknown id). Every way a course gets into training goes through
 * here: the New run dialog, a run's settings and a script's useCourse.
 */
export function trainingCourse(id: string): CourseSpec | undefined {
  return TRAINING_COURSES.find((c) => c.id === id);
}
