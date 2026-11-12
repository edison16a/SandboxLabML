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

/** One generation's worth of history. Stored per generation in IndexedDB. */
export interface GenerationRecord<C extends ChampionRecord = ChampionRecord> {
  runId: string;
  generation: number;
  stats: GenerationStats;
  champion: C;
  /** The champion's genome, kept so any generation can be replayed or branched from. */
  genome: Genome;
  /**
   * Hash of the content the generation ran on, from the env module's
   * contentHash. The name is older than the env registry; stored rows
   * and exports keep it.
   */
  trackHash: string;
  /** Seed used for the champion's sensor noise and script rand(), needed for an exact replay. */
  replaySeed: number;
  /** The champion's start slot, for envs that hand out slots (see EpisodeEnvModule.startSlots). */
  replaySlot?: number;
  /** Seconds of simulated time across the whole population. */
  simSeconds: number;
  wallMs: number;
  /** Stats over the whole generation, keyed like the env module's generation metrics. */
  metrics?: Record<string, number>;
  /** The content the generation ran on, kept for envs whose module sets contentOnRecords. Plain data. */
  content?: unknown;
  /** Optional chart markers, such as "script edited". */
  markers?: string[];
  benchmark?: number;
}

