import type { EnvId } from '../env/types';

/** The four axes of the Racing radar chart, each 0 to 1. */
export interface RacingRadar {
  speed: number;
  completion: number;
  smoothness: number;
  generalization: number;
}

/** The four axes of the Hide and Seek radar chart, each 0 to 1. See bench/hideseek/scoring.ts. */
export interface HideSeekRadar {
  hiding: number;
  seeking: number;
  cover: number;
  generalization: number;
}

/**
 * Radar values for one result. Each environment has its own axes, so the
 * chart reads their keys and labels from RADAR_AXES instead of assuming
 * Racing's four.
 */
export type BenchRadar = RacingRadar | HideSeekRadar;

/** The preset tiers that have reference results. */
export type ReferenceTier = 'beginner' | 'intermediate' | 'advanced';

/** One reference script's result at a given generation, from the shipped reference files. */
export interface ReferencePoint {
  generation: number;
  median: number;
  p25: number;
  p75: number;
}

export interface ReferenceCurve {
  tier: ReferenceTier;
  /** The final reference champion's score, shown on the result card. */
  finalScore: number;
  curve: ReferencePoint[];
}

/**
 * A benchmark result. The exam is independent of the training reward and of
 * the brain's shape, so models trained with different scripts and inputs
 * compare fairly. Scores only compare within the same benchmarkVersion.
 */
export interface BenchResult {
  env: EnvId;
  benchmarkVersion: number;
  engineVersion: number;
  /** Composite score, 0 to 100. */
  score: number;
  radar: BenchRadar;
  /** Raw metrics, e.g. laps, lapTime, crashRate for racing or hiddenShare, winRate, elo for hide and seek. */
  metrics: Record<string, number>;
  /** Per track (racing) or per layout and opponent (hide and seek) breakdown. */
  parts: Array<{ id: string; label: string; score: number; metrics: Record<string, number> }>;
  /** Score per 100 parameters, which ties the benchmark to the model card. */
  scorePer100Params: number;
}

/** What the Bench tab shows next to the user's result. */
export interface BenchReferences {
  env: EnvId;
  benchmarkVersion: number;
  engineVersion: number;
  /** Generated at, ISO date. */
  generatedAt: string;
  seeds: number;
  references: ReferenceCurve[];
}
