import type { EnvId } from '../env/types';

/**
 * Radar values for one result, each 0 to 1, keyed by axis. Each env has
 * its own axes, so the chart reads their keys and labels from the env's
 * benchmark (radarAxesOf).
 */
export type BenchRadar = Readonly<Record<string, number>>;

/** Progress and cancel for a benchmark that runs in slices. */
export interface BenchOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

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
  /** Raw metrics, such as the share of trips that arrived. */
  metrics: Record<string, number>;
  /** One row per part of the exam, such as a city or a course. */
  parts: Array<{ id: string; label: string; score: number; metrics: Record<string, number> }>;
  /** Score per 100 parameters, which ties the benchmark to the model card. */
  scorePer100Params: number;
}

/**
 * A shipped champion of a single population env: the final champion of a
 * typical seed of one preset's reference runs. The Sandbox plays it under
 * "Try a trained model", so a newcomer sees a skilled agent before
 * training one. Its brain is the preset blueprint `blueprint`, plus the
 * sensors of the script preset `preset`, if that script has any.
 */
export interface ReferenceModel {
  tier: ReferenceTier;
  seed: number;
  generation: number;
  /** Its benchmark score, 0 to 100. */
  score: number;
  blueprint: string;
  preset: string;
  /** The genome in the binary format, as base64. */
  genome: string;
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
  /** One trained champion per preset, for the Sandbox. */
  models?: ReferenceModel[];
}
