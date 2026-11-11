import { mixSeed } from '../core/rng';
import { generateCourse } from './course/generate';
import { TOP_LEVEL } from './course/levels';
import type { CourseSpec } from './course/types';

/** Share of the population that must finish before the curriculum moves on. */
export const ADVANCE_SHARE = 0.6;
/** Courses each brain runs per generation by default. Averaging over a few keeps a lucky course from deciding a brain's fate. */
export const COURSES_PER_GENERATION = 2;

/**
 * The automatic curriculum: one level up once at least ADVANCE_SHARE of
 * the population finished the current level's courses, never past the top.
 * It never drops back down; a script's generation block can, if it wants.
 */
export function nextLevel(level: number, finishedShare: number): number {
  return finishedShare >= ADVANCE_SHARE ? Math.min(TOP_LEVEL, level + 1) : level;
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
