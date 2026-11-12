import { MAX_LEVEL, MIN_LEVEL } from './levels';

/** Move up once the judged safe share, averaged over a level's window, reaches this. */
export const ADVANCE_SHARE = 0.5;
/** The bars a script's autoLevel may ask for. */
export const MIN_BAR = 0.02;
export const MAX_BAR = 1;
/**
 * Traffic and rush hour step back down a level once the judged share,
 * averaged over the last STEP_WINDOW generations, stays under STEP_SHARE
 * after STEP_AFTER generations there. A run that reaches other cars too
 * early can collapse into parking behind them, and a level it cannot
 * drive at all teaches nothing. The levels below never step down: the
 * dip right after a new level is how lights and people get learned.
 */
export const STEP_SHARE = 0.05;
export const STEP_WINDOW = 20;
export const STEP_AFTER = 60;
/** The lowest level a step down lands on. */
export const STEP_FLOOR = 3;

/**
 * How long a level is judged before the run leaves it: how many
 * generations the share is averaged over, and how many it plays at least.
 * Leaving for traffic and rush hour waits longer, since a run that gets
 * there too early stops driving altogether.
 */
export function advanceRule(level: number): { window: number; min: number } {
  return level >= 3 ? { window: 8, min: 12 } : { window: 5, min: 6 };
}

/**
 * Where the automatic curriculum stands. Plain data and small, so every
 * generation record can keep it and a resumed run or a branch picks it up
 * exactly as it was.
 */
export interface Curriculum {
  level: number;
  /** Generations played at this level so far. */
  generations: number;
  /** Judged safe share (0 to 1) of the latest generations at this level, oldest first, at most STEP_WINDOW kept. */
  recent: number[];
  /** The share that moves it up: ADVANCE_SHARE, or what a script's autoLevel asked for. */
  bar: number;
  /** The level it last stepped back down from, until it moves up again. Runs saved before step downs have none. */
  fell?: number;
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

/** Mean of the last `n` values, or NaN when fewer than `n` are kept. */
function lastMean(values: readonly number[], n: number): number {
  if (values.length < n) return NaN;
  let sum = 0;
  for (let i = values.length - n; i < values.length; i++) sum += values[i];
  return sum / n;
}

/**
 * Records one generation's judged safe share and returns where the
 * curriculum stands for the next generation, as a new object. The share
 * is the safe arrivals of the champions kept from the generation before,
 * on trips they were not picked on (see judgedSafeShare), so luck on the
 * routes that made them champions cannot lift it. It moves up on an
 * average over a few generations, because a new route every generation
 * makes one count swing. It steps back down from traffic or rush hour
 * only when they have gone on for long with almost no safe arrivals, and
 * moves up again the same way.
 */
export function advanceCurriculum(c: Curriculum, share: number): Curriculum {
  const recent = [...c.recent, Number.isFinite(share) ? share : 0].slice(-STEP_WINDOW);
  const generations = c.generations + 1;
  const rule = advanceRule(c.level);
  if (c.level < MAX_LEVEL && generations >= rule.min && lastMean(recent, rule.window) >= c.bar) {
    return { level: c.level + 1, generations: 0, recent: [], bar: c.bar };
  }
  if (c.level > STEP_FLOOR && generations >= STEP_AFTER && lastMean(recent, STEP_WINDOW) < STEP_SHARE) {
    return { level: c.level - 1, generations: 0, recent: [], bar: c.bar, fell: c.level };
  }
  return { ...c, generations, recent };
}
