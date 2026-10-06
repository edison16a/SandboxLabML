import type { RngState } from '../../core/rng';
import type { NeatConfig } from '../../neat/config';
import type { PopulationState } from '../../neat/population';
import type { GenerationStats } from '../../neat/stats';
import type { Activation, Genome, GenomeShape } from '../../neat/types';
import type { HideSeekInputConfig } from '../inputConfig';
import type { HideSeekLayoutId } from '../layouts/types';
import type { HideSeekPhysics } from '../physics';
import type { HideSeekRewardId } from '../rewards';

/**
 * Rounds of each kind of opponent in one generation. Every round gives each
 * current genome one scored match.
 */
export interface HideSeekOpponents {
  /** Rounds against the other team's current genomes. Both sides score. */
  current: number;
  /** Rounds against past champions. Only the current genome scores. */
  hallOfFame: number;
  /**
   * Rounds against the hand-written agents: hiders meet the scripted seeker
   * and seekers the scripted hider. Only the current genome scores. They
   * give fitness a fixed reference while the evolved opponents are still
   * clumsy, and their hidden and seen shares are a live yardstick.
   */
  scripted: number;
}

/**
 * Named training setups. `v1` is the original: v1 rewards, two current
 * rounds and two hall of fame rounds. `v2` learns visibly faster: cover
 * rewards and one of the hall of fame rounds swapped for a scripted
 * sparring round, with the rooms mixed within each round. See setups.ts.
 */
export type HideSeekSetupId = 'v1' | 'v2';

/**
 * Match rules that may change between generations, set by a script's each
 * generation block or by the lab. Missing fields keep their current value.
 * A type alias, not an interface, so it also fits a Record<string, unknown>.
 */
export type HideSeekDirective = {
  opponents?: Partial<HideSeekOpponents>;
  /** Prep phase length, s. */
  prepSeconds?: number;
  /** Rooms, cycled by round. */
  layouts?: HideSeekLayoutId[];
  /** Past champions kept per team. */
  hallOfFameSize?: number;
};

/** How a co-evolution run is set up. Everything but the seed and inputs has a default. */
export interface HideSeekTrainerOptions {
  seed: number;
  /** Which setup fills the defaults below. Default v2 for new runs. */
  setup?: HideSeekSetupId;
  /** What each team senses. The two may differ. */
  hiderInputs: HideSeekInputConfig;
  seekerInputs: HideSeekInputConfig;
  /** Genomes per team. Default 50. A team's NEAT override wins over this. */
  populationSize?: number;
  hiderNeat?: Partial<NeatConfig>;
  seekerNeat?: Partial<NeatConfig>;
  activation?: Activation;
  wiring?: GenomeShape['wiring'];
  hiddenCount?: number;
  /** Script sensors per team, appended after the built-in inputs. */
  hiderCustomSensors?: number;
  seekerCustomSensors?: number;
  /** Rooms, cycled by round. Default: open, shelter, corridor. */
  layouts?: HideSeekLayoutId[];
  /**
   * Rounds per generation, 1 to 4: the first two against current genomes,
   * the rest against the hall of fame. Ignored when `opponents` is given.
   */
  rounds?: number;
  /** Rounds of each kind of opponent, 1 to 6 in total. Wins over `rounds`. */
  opponents?: HideSeekOpponents;
  /**
   * Mix the rooms within rounds instead of one room per round, so a per
   * round number such as the sparring share does not jump with the room.
   * Every hider still meets each room equally often. See roomOf in
   * schedule.ts.
   */
  mixLayouts?: boolean;
  /**
   * Every match of a round starts from the same seed, so hiders in the
   * same room start from the same spots with the same box jitter. Genomes
   * of a round are then compared on equal terms, which cuts the luck in
   * fitness. Seeds still change every round and generation.
   */
  sharedSeeds?: boolean;
  /** Prep phase length, s. Default: the physics prepShare (9 s of a 30 s match). */
  prepSeconds?: number;
  /** Past champions kept per team. Default 20. */
  hallOfFameSize?: number;
  /** Built-in rewards for teams without a script. Default from the setup. */
  reward?: HideSeekRewardId;
  physics?: HideSeekPhysics;
}

/**
 * Options with every default filled in. Stored in checkpoints so a resumed
 * run plays the same rules. Directives update the rules between
 * generations, so a checkpoint holds the rules for the next generation.
 */
export type ResolvedTrainerOptions = Required<Omit<HideSeekTrainerOptions, 'hiderNeat' | 'seekerNeat' | 'hiddenCount' | 'prepSeconds'>> &
  Pick<HideSeekTrainerOptions, 'hiderNeat' | 'seekerNeat' | 'hiddenCount' | 'prepSeconds'>;

/** A past champion kept as an opponent for later generations. */
export interface HallOfFameEntry {
  genome: Genome;
  generation: number;
  fitness: number;
}

/** Hide and Seek numbers for one generation, averaged over its matches. */
export interface HideSeekMatchStats {
  matches: number;
  /** Mean share of seek time the hider stayed hidden, over every match. */
  hiddenShare: number;
  seenShare: number;
  /**
   * Hidden share over matches between two current genomes only (rounds 1
   * and 2). Hall of fame matches pit a team against older opponents, so this
   * is the cleaner view of the arms race.
   */
  currentHiddenShare: number;
  locksPerMatch: number;
  boxesMovedPerMatch: number;
  grabsPerMatch: number;
  hallOfFame: { hiders: number; seekers: number };
  /** Mean share of seek time the hider was exposed, over every match. Missing in older histories. */
  exposedShare?: number;
  /**
   * Hidden share of current hiders against the scripted seeker, and seen
   * share of current seekers against the scripted hider. Only present in
   * generations with scripted rounds. The same yardsticks every
   * generation, so unlike the co-evolution numbers they rise with skill.
   */
  scriptedHiddenShare?: number;
  scriptedSeenShare?: number;
}

/** One row of the run's history: NEAT stats for both teams plus the game numbers. */
export interface HideSeekGenerationStats {
  generation: number;
  hiders: GenerationStats;
  seekers: GenerationStats;
  game: HideSeekMatchStats;
}

/** Everything needed to resume a run exactly where it stopped. Plain JSON. */
export interface HideSeekTrainerState {
  version: 1;
  options: ResolvedTrainerOptions;
  hiders: PopulationState;
  seekers: PopulationState;
  hallOfFame: { hiders: HallOfFameEntry[]; seekers: HallOfFameEntry[] };
  rng: RngState;
  history: HideSeekGenerationStats[];
}
