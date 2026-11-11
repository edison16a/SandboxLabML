import { FINISH_INSET, START_ZONE, type CourseSpec } from './types';

/** Least depth behind the start line, m, so a few rows of runners fit. */
export const MIN_START_ZONE = 3;
/** Least run from the start line to the finish line, m. */
export const MIN_RUN = 10;
/** Least room past the finish line, m, for finishers to run through. */
export const MIN_RUN_OUT = 1.5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where a course's start line and finish line stand along x, m. Generated
 * and named courses keep the standard spots (START_ZONE from the back
 * wall, FINISH_INSET from the end wall); a course drawn in the Sandbox
 * may move either, and this clamps them so there is always room to line
 * up, to run and to run out.
 */
export function courseLines(spec: Pick<CourseSpec, 'length' | 'start' | 'finish'>): { start: number; finish: number } {
  const hl = spec.length / 2;
  const finish = clamp(Number.isFinite(spec.finish) ? spec.finish! : hl - FINISH_INSET, -hl + MIN_START_ZONE + MIN_RUN, hl - MIN_RUN_OUT);
  const start = clamp(Number.isFinite(spec.start) ? spec.start! : -hl + START_ZONE, -hl + MIN_START_ZONE, finish - MIN_RUN);
  return { start, finish };
}
