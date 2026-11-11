import { mixSeed } from '../core/rng';
import { generateCourse } from './course/generate';
import { TOP_LEVEL } from './course/levels';
import type { CourseSpec } from './course/types';

/** Courses each brain runs per generation by default. Averaging over a few keeps a lucky course from deciding a brain's fate. */
export const COURSES_PER_GENERATION = 2;
/** The best brains the curriculum watches: this share of the population, by fitness. */
export const ELITE_SHARE = 0.2;
/** Share of the courses those brains must finish, averaged over the last WINDOW generations, to move on. */
export const ELITE_BAR = 0.75;
export const WINDOW = 2;
/** Fewest generations spent on a level, so every level is seen, however easy. */
export const MIN_GENERATIONS = 3;

/**
 * Where the automatic curriculum stands. Plain JSON, so it can live in a
 * checkpoint: the level, how many generations ran on it, and the elite
 * finish shares of the latest of them, newest last.
 */
export interface CurriculumState {
  level: number;
  generations: number;
  recent: number[];
}

export function startCurriculum(level = 0): CurriculumState {
  return { level: Math.max(0, Math.min(TOP_LEVEL, Math.floor(level))), generations: 0, recent: [] };
}

/**
 * How well the best brains did: the top ELITE_SHARE of the population by
 * fitness, and the share of all their courses they finished. A mutated
 * population always holds brains that fall over, so the whole population's
 * finish share is a poor sign of mastery on a deadly level; the elite's is
 * steady, and it is the elite that breeds the next generation.
 * `finished[i]` is how many of the generation's `courses` brain i finished.
 */
export function eliteFinishShare(fitness: ArrayLike<number>, finished: ArrayLike<number>, courses: number): number {
  const n = fitness.length;
  if (n === 0 || courses <= 0) return 0;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => fitness[b] - fitness[a] || a - b);
  const count = Math.max(1, Math.round(n * ELITE_SHARE));
  let done = 0;
  for (let k = 0; k < count; k++) done += Math.min(courses, finished[order[k]]);
  return done / (count * courses);
}

/**
 * The automatic curriculum after a generation with elite finish share
 * `share`: one level up once the level has run MIN_GENERATIONS and the
 * share averaged over the last WINDOW generations reaches `bar`, never
 * past the top. It never drops back down; a script's generation block can,
 * if it wants, and can pass its own signal and bar.
 */
export function advanceCurriculum(state: CurriculumState, share: number, bar = ELITE_BAR): CurriculumState {
  const recent = [...state.recent, share].slice(-WINDOW);
  const generations = state.generations + 1;
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (state.level < TOP_LEVEL && generations >= MIN_GENERATIONS && recent.length >= WINDOW && mean >= bar) return { level: state.level + 1, generations: 0, recent: [] };
  return { level: state.level, generations, recent };
}

/**
 * The courses a generation runs: `count` fresh courses of `level`, seeded
 * by the run seed and the generation. Every brain of the generation runs
 * the same ones, which keeps the comparison fair, and the next generation
 * gets new ones, so brains learn to navigate rather than memorize a room.
 */
export function generationCourses(level: number, runSeed: number, generation: number, count = COURSES_PER_GENERATION): CourseSpec[] {
  return Array.from({ length: count }, (_, i) => generateCourse(level, mixSeed(runSeed, generation, i, 0x636f)));
}
