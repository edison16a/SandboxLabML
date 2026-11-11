import { MAX_LEVEL, MIN_LEVEL } from './levels';

/** Generations the curriculum averages over before moving up. */
export const ADVANCE_WINDOW = 5;
/** Move up once the safe share averaged over ADVANCE_WINDOW generations reaches this. */
export const ADVANCE_SHARE = 0.1;
/** Move back down when the safe share averaged over DEMOTE_WINDOW generations at a level stays under this. */
export const DEMOTE_WINDOW = 40;
export const DEMOTE_SHARE = 0.01;
/** After moving down, generations to practise before the curriculum may move up again. */
export const DEMOTE_REST = 15;

/**
 * Where the automatic curriculum stands. Plain data, so a run can store it
 * and a worker or a resumed run picks it up as it was.
 */
export interface Curriculum {
  level: number;
  /** Safe share (0 to 1) of each generation played at this level, oldest first, at most DEMOTE_WINDOW kept. */
  shares: number[];
  /** Generations left before it may move up again, after moving down. */
  rest: number;
}

export function startCurriculum(level = MIN_LEVEL): Curriculum {
  return { level: Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level)), shares: [], rest: 0 };
}

function meanOfLast(values: number[], n: number): number {
  let sum = 0;
  for (let i = values.length - n; i < values.length; i++) sum += values[i];
  return sum / n;
}

/**
 * Records one generation's safe arrivals (arrived with no crash, no person
 * hit and no red light run) and returns where the curriculum stands for the
 * next generation. It moves on an average over several generations, because
 * a new trip every generation makes a single count swing with the luck of
 * the route. It moves back down when a level proves too hard to make any
 * progress on, then rests a while before trying again.
 */
export function advanceCurriculum(c: Curriculum, safeArrivals: number, population: number): Curriculum {
  const share = population > 0 ? safeArrivals / population : 0;
  const shares = [...c.shares, share].slice(-DEMOTE_WINDOW);
  const rest = Math.max(0, c.rest - 1);
  if (c.level < MAX_LEVEL && rest === 0 && shares.length >= ADVANCE_WINDOW && meanOfLast(shares, ADVANCE_WINDOW) >= ADVANCE_SHARE) {
    return { level: c.level + 1, shares: [], rest: 0 };
  }
  if (c.level > MIN_LEVEL && shares.length >= DEMOTE_WINDOW && meanOfLast(shares, DEMOTE_WINDOW) < DEMOTE_SHARE) {
    return { level: c.level - 1, shares: [], rest: DEMOTE_REST };
  }
  return { level: c.level, shares, rest };
}
