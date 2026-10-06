/**
 * Names of what Hide and Seek checks can measure, kept apart from the code
 * that measures them. Validation and error messages need the names, and
 * importing them must not pull in the physics engine.
 */

/** What one test match measures. */
export const TEST_MATCH_METRICS = [
  'hiderReward',
  'seekerReward',
  'rewardSum',
  'hiddenShare',
  'seenShare',
  'hiderDistance',
  'seekerDistance',
  'grabs',
  'locks',
  'boxesMoved',
  'inputs',
] as const;

export type TestMatchMetric = (typeof TEST_MATCH_METRICS)[number];
export type TestMatchMetrics = Record<TestMatchMetric, number>;

/**
 * What a Hide and Seek training check measures. Game numbers and best
 * scores are the highest any generation reached; the hall of fame and
 * species counts are where the last generation left them.
 */
export const HIDESEEK_TRAINING_METRICS = [
  'hiderBest',
  'seekerBest',
  'hiddenShare',
  'seenShare',
  'currentHiddenShare',
  'scriptedHiddenShare',
  'scriptedSeenShare',
  'grabsPerMatch',
  'locksPerMatch',
  'boxesMovedPerMatch',
  'matches',
  'hallOfFameMatches',
  'hallOfFame',
  'hiderSpecies',
  'seekerSpecies',
] as const;

export type HideSeekTrainingMetric = (typeof HIDESEEK_TRAINING_METRICS)[number];
export type HideSeekTrainingMetrics = Record<HideSeekTrainingMetric, number>;

/**
 * Most generations a Hide and Seek training check may ask for. A
 * generation plays dozens of 30 second matches, so this keeps a check
 * to a few seconds.
 */
export const MAX_HIDESEEK_CHECK_GENERATIONS = 5;

const round = (v: number) => String(Math.round(v * 100) / 100);
const points = (v: number) => `${round(v)} points`;
const share = (v: number) => `${Math.round(v * 100)}%`;
const meters = (v: number) => `${Math.round(v * 10) / 10} m`;
const count = (one: string, many: string) => (v: number) => `${round(v)} ${v === 1 ? one : many}`;
const perMatch = (what: string) => (v: number) => `${round(v)} ${what} per match`;

/** Hide and Seek metrics in plain words, so an outcome reads "35%" rather than "0.3492". */
export const HIDESEEK_FORMATS: Record<string, (v: number) => string> = {
  hiderReward: points,
  seekerReward: points,
  rewardSum: points,
  hiderBest: points,
  seekerBest: points,
  hiddenShare: share,
  seenShare: share,
  currentHiddenShare: share,
  scriptedHiddenShare: share,
  scriptedSeenShare: share,
  hiderDistance: meters,
  seekerDistance: meters,
  grabs: count('grab', 'grabs'),
  locks: count('lock', 'locks'),
  boxesMoved: count('box moved', 'boxes moved'),
  grabsPerMatch: perMatch('grabs'),
  locksPerMatch: perMatch('locks'),
  boxesMovedPerMatch: perMatch('boxes moved'),
  matches: count('match', 'matches'),
  hallOfFameMatches: count('match against past champions', 'matches against past champions'),
  hallOfFame: count('past champion kept', 'past champions kept'),
  hiderSpecies: count('hider species', 'hider species'),
  seekerSpecies: count('seeker species', 'seeker species'),
};
