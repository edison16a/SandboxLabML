import { HIDESEEK_LAYOUT_IDS } from '../layouts/presets';
import { DEFAULT_HIDESEEK_PHYSICS } from '../physics';
import type { HideSeekRewardId } from '../rewards';
import type { HideSeekOpponents, HideSeekSetupId, HideSeekTrainerOptions, ResolvedTrainerOptions } from './types';

/** What a named setup decides when the options leave it open. */
export interface HideSeekSetup {
  reward: HideSeekRewardId;
  opponents: HideSeekOpponents;
  mixLayouts: boolean;
  sharedSeeds: boolean;
}

/**
 * The named setups. v1 is the original co-evolution. v2 changes two things
 * that measurably speed up visible learning (numbers in the measurement
 * script's header): cover rewards, which give hiders a signal that does
 * not depend on how good the seekers are, and one scripted sparring round
 * in place of a hall of fame round, so fitness has a fixed reference from
 * the first generation. It also mixes the rooms within rounds, so the
 * sparring share is comparable from one generation to the next. It plays
 * the same 6N matches per generation.
 */
export const HIDESEEK_SETUPS: Record<HideSeekSetupId, HideSeekSetup> = {
  v1: { reward: 'v1', opponents: { current: 2, hallOfFame: 2, scripted: 0 }, mixLayouts: false, sharedSeeds: false },
  v2: { reward: 'cover', opponents: { current: 2, hallOfFame: 1, scripted: 1 }, mixLayouts: true, sharedSeeds: false },
};

/** Setup for new runs that do not name one. */
export const DEFAULT_HIDESEEK_SETUP: HideSeekSetupId = 'v2';

/** Most rounds a generation may have, which caps matches at 8N per generation. */
export const MAX_ROUNDS = 6;

/**
 * The mix for the plain `rounds` option: the first two rounds are current,
 * then come the setup's scripted rounds, then hall of fame rounds. Under
 * v1 that is the original meaning, and under v2 four rounds is its usual mix.
 */
function fromRounds(rounds: number, setup: HideSeekSetup): HideSeekOpponents {
  if (rounds < 1 || rounds > 4) throw new Error('A generation has 1 to 4 rounds.');
  const current = Math.min(rounds, 2);
  const scripted = Math.min(rounds - current, setup.opponents.scripted);
  return { current, hallOfFame: rounds - current - scripted, scripted };
}

/** Throws on a mix nobody can play: negative or fractional counts, or a total outside 1 to MAX_ROUNDS. */
export function checkOpponents(o: HideSeekOpponents): HideSeekOpponents {
  const counts = [o.current, o.hallOfFame, o.scripted];
  if (counts.some((n) => !Number.isInteger(n) || n < 0)) throw new Error('Opponent rounds must be whole numbers from 0 up.');
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 1 || total > MAX_ROUNDS) throw new Error(`A generation has 1 to ${MAX_ROUNDS} rounds.`);
  return { current: o.current, hallOfFame: o.hallOfFame, scripted: o.scripted };
}

export function roundCount(o: HideSeekOpponents): number {
  return o.current + o.hallOfFame + o.scripted;
}

/** Fills in every default, so the stored options fully describe the run. */
export function resolveTrainerOptions(o: HideSeekTrainerOptions): ResolvedTrainerOptions {
  const setupId = o.setup ?? DEFAULT_HIDESEEK_SETUP;
  const setup = HIDESEEK_SETUPS[setupId];
  if (!setup) throw new Error(`Unknown Hide and Seek setup "${setupId}".`);
  const opponents = checkOpponents(o.opponents ?? (o.rounds !== undefined ? fromRounds(Math.round(o.rounds), setup) : setup.opponents));
  return {
    ...o,
    setup: setupId,
    populationSize: o.populationSize ?? 50,
    activation: o.activation ?? 'tanh',
    wiring: o.wiring ?? 'direct',
    hiderCustomSensors: o.hiderCustomSensors ?? 0,
    seekerCustomSensors: o.seekerCustomSensors ?? 0,
    layouts: o.layouts?.length ? [...o.layouts] : [...HIDESEEK_LAYOUT_IDS],
    rounds: roundCount(opponents),
    opponents,
    mixLayouts: o.mixLayouts ?? setup.mixLayouts,
    sharedSeeds: o.sharedSeeds ?? setup.sharedSeeds,
    hallOfFameSize: o.hallOfFameSize ?? 20,
    reward: o.reward ?? setup.reward,
    physics: o.physics ?? DEFAULT_HIDESEEK_PHYSICS,
  };
}

/**
 * Options from a checkpoint. Checkpoints written before setups existed
 * have no setup, opponents, room mixing or shared starts, and they ran as
 * v1, so they resume as v1 rather than picking up the newer defaults.
 */
export function upgradeStoredOptions(stored: ResolvedTrainerOptions): ResolvedTrainerOptions {
  const o = stored as Partial<ResolvedTrainerOptions> & ResolvedTrainerOptions;
  if (o.setup && o.opponents && o.mixLayouts !== undefined && o.sharedSeeds !== undefined) return stored;
  return {
    ...stored,
    setup: o.setup ?? 'v1',
    opponents: o.opponents ?? fromRounds(o.rounds, HIDESEEK_SETUPS.v1),
    mixLayouts: o.mixLayouts ?? false,
    sharedSeeds: o.sharedSeeds ?? false,
  };
}
