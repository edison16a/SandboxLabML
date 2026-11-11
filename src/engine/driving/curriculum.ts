import { MAX_LEVEL, MIN_LEVEL } from './levels';

/** Generations whose safe share is averaged before moving up. */
export const ADVANCE_WINDOW = 3;
/** Move up once the safe share averaged over ADVANCE_WINDOW generations reaches this. */
export const ADVANCE_SHARE = 0.5;
/** Generations a level is played at least, so a new level is never skipped on one lucky start. */
export const MIN_GENERATIONS = 3;
/** The bars a script's autoLevel may ask for. */
export const MIN_BAR = 0.02;
export const MAX_BAR = 1;

/**
 * Where the automatic curriculum stands. Plain data and small, so every
 * generation record can keep it and a resumed run or a branch picks it up
 * exactly as it was.
 */
export interface Curriculum {
  level: number;
  /** Generations played at this level so far. */
  generations: number;
  /** Safe share (0 to 1) of the latest generations at this level, oldest first, at most ADVANCE_WINDOW kept. */
  recent: number[];
  /** The share that moves it up: ADVANCE_SHARE, or what a script's autoLevel asked for. */
  bar: number;
}

function clampBar(bar: number): number {
  return Math.min(MAX_BAR, Math.max(MIN_BAR, Number.isFinite(bar) ? bar : ADVANCE_SHARE));
}

export function startCurriculum(level = MIN_LEVEL, bar = ADVANCE_SHARE): Curriculum {
  return { level: Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level))), generations: 0, recent: [], bar: clampBar(bar) };
}

/** The same curriculum with another bar, keeping what it measured so far. */
export function withBar(c: Curriculum, bar: number): Curriculum {
  const next = clampBar(bar);
  return next === c.bar ? c : { ...c, bar: next };
}

/**
 * Records one generation's safe share (drives that arrived with no crash,
 * no person hit and no red light run, out of every drive) and returns where
 * the curriculum stands for the next generation, as a new object. It moves
 * on an average over a few generations, because a new route every
 * generation makes one count swing with the luck of the route. It never
 * moves back down: a level that is hard just takes longer, and a level
 * that bounces up and down tells a newcomer nothing.
 */
export function advanceCurriculum(c: Curriculum, share: number): Curriculum {
  const recent = [...c.recent, Number.isFinite(share) ? share : 0].slice(-ADVANCE_WINDOW);
  const generations = c.generations + 1;
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (c.level < MAX_LEVEL && generations >= MIN_GENERATIONS && recent.length >= ADVANCE_WINDOW && mean >= c.bar) {
    return { level: c.level + 1, generations: 0, recent: [], bar: c.bar };
  }
  return { level: c.level, generations, recent, bar: c.bar };
}
