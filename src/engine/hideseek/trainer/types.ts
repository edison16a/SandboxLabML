import type { RngState } from '../../core/rng';
import type { NeatConfig } from '../../neat/config';
import type { PopulationState } from '../../neat/population';
import type { GenerationStats } from '../../neat/stats';
import type { Activation, Genome, GenomeShape } from '../../neat/types';
import type { HideSeekInputConfig } from '../inputConfig';
import type { HideSeekLayoutId } from '../layouts/types';
import type { HideSeekPhysics } from '../physics';
import type { HideSeekRewardId } from '../rewards';

/** How a co-evolution run is set up. Everything but the seed and inputs has a default. */
export interface HideSeekTrainerOptions {
  seed: number;
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
  /** Rounds per generation, 1 to 4. Default 4. */
  rounds?: number;
  /** Past champions kept per team. Default 20. */
  hallOfFameSize?: number;
  /** Built-in rewards for teams without a script. Default v1. */
  reward?: HideSeekRewardId;
  physics?: HideSeekPhysics;
}

/** Options with every default filled in. Stored in checkpoints so a resumed run plays the same rules. */
export type ResolvedTrainerOptions = Required<Omit<HideSeekTrainerOptions, 'hiderNeat' | 'seekerNeat' | 'hiddenCount'>> &
  Pick<HideSeekTrainerOptions, 'hiderNeat' | 'seekerNeat' | 'hiddenCount'>;

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
