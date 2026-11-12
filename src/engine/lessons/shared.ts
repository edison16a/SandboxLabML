/**
 * What every lesson check shares, whichever lab it is for: the small,
 * fixed run it trains, how long it may train, and the seed of the hand
 * set test brain each env builds for its test runs.
 */

/** Small and fixed, so a check trains in a few seconds and gives every learner the same answer. */
export const LESSON_POPULATION = 40;
export const LESSON_SEED = 2024;

/** More than this and a check would keep a learner waiting too long. */
export const MAX_CHECK_GENERATIONS = 30;

/** Seed for the test brain's genome ids. Each env sets its weights by hand, so only the structure comes from it. */
export const TEST_BRAIN_SEED = 0x7e57;

export interface TrainingOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}
