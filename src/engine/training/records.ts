import type { GenerationStats } from '../neat/stats';
import type { Genome } from '../neat/types';

/**
 * The best agent of a generation, which becomes a ghost in the overlay view.
 * Every env fills these three fields; its own outcome numbers go in
 * `metrics`, keyed like the env module's champion metrics.
 */
export interface ChampionRecord {
  genomeId: number;
  fitness: number;
  stopReason: string | null;
  metrics?: Record<string, number>;
}

/**
 * Racing's champion. Its fields predate the metrics map and stay where
 * they always were, so stored runs and exports keep their layout.
 */
export interface RacingChampionRecord extends ChampionRecord {
  /** Meters along the road before stopping. */
  distance: number;
  laps: number;
  bestLapTime: number;
  crashed: boolean;
  crashX: number;
  crashY: number;
}

/** One generation's worth of history. Stored per generation in IndexedDB. */
export interface GenerationRecord<C extends ChampionRecord = ChampionRecord> {
  runId: string;
  generation: number;
  stats: GenerationStats;
  champion: C;
  /** The champion's genome, kept so any generation can be replayed or branched from. */
  genome: Genome;
  /** Hash of the content the generation ran on (Racing: the track), from the env module's contentHash. */
  trackHash: string;
  /** Seed used for the champion's sensor noise and script rand(), needed for an exact replay. */
  replaySeed: number;
  /** Seconds of simulated time across the whole population. */
  simSeconds: number;
  wallMs: number;
  /** Stats over the whole generation, keyed like the env module's generation metrics. Racing has none. */
  metrics?: Record<string, number>;
  /** The content the generation ran on, kept for envs whose module sets contentOnRecords. Plain data. */
  content?: unknown;
  /** Optional chart markers, such as "script edited". */
  markers?: string[];
  benchmark?: number;
}

export type RacingRecord = GenerationRecord<RacingChampionRecord>;
