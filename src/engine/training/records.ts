import type { GenerationStats } from '../neat/stats';
import type { Genome } from '../neat/types';

/** The best car of a generation, which becomes a ghost in the overlay view. */
export interface ChampionRecord {
  genomeId: number;
  fitness: number;
  /** Meters along the road before stopping. */
  distance: number;
  laps: number;
  bestLapTime: number;
  crashed: boolean;
  crashX: number;
  crashY: number;
  stopReason: string | null;
}

/** One generation's worth of history. Stored per generation in IndexedDB. */
export interface GenerationRecord {
  runId: string;
  generation: number;
  stats: GenerationStats;
  champion: ChampionRecord;
  /** The champion's genome, kept so any generation can be replayed or branched from. */
  genome: Genome;
  trackHash: string;
  /** Seed used for the champion's sensor noise, needed for an exact replay. */
  replaySeed: number;
  /** Seconds of simulated driving across the whole population. */
  simSeconds: number;
  wallMs: number;
  /** Optional chart markers, such as "script edited". */
  markers?: string[];
  benchmark?: number;
}
