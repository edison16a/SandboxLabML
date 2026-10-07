import type { EnvId } from '../env/types';
import type { BenchReferences, ReferenceBrain, ReferenceChampion, ReferenceCurve, ReferencePoint, ReferenceTier } from './types';

export const REFERENCE_TIERS: readonly ReferenceTier[] = ['beginner', 'intermediate', 'advanced'];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isPoint(v: unknown): v is ReferencePoint {
  return isObj(v) && isNum(v.generation) && isNum(v.median) && isNum(v.p25) && isNum(v.p75);
}

function isCurve(v: unknown): v is ReferenceCurve {
  return isObj(v) && REFERENCE_TIERS.includes(v.tier as ReferenceTier) && isNum(v.finalScore) && Array.isArray(v.curve) && v.curve.every(isPoint);
}

/** Checks the parts of an input config the exam reads first. The genome decoder checks the rest when it loads. */
function isBrain(v: unknown): v is ReferenceBrain {
  return isObj(v) && typeof v.genome === 'string' && isObj(v.inputs) && isObj(v.inputs.rays) && isNum(v.inputs.rays.count) && isNum(v.inputs.nearestBoxes);
}

function isChampion(v: unknown): v is ReferenceChampion {
  return isObj(v) && REFERENCE_TIERS.includes(v.tier as ReferenceTier) && isNum(v.seed) && isNum(v.generation) && isNum(v.rating) && isBrain(v.hider) && isBrain(v.seeker);
}

/**
 * Checks that parsed JSON really is a reference file. The file is fetched
 * over the network and may be stale or truncated, so anything unexpected
 * becomes null rather than a half-filled chart.
 */
export function parseReferences(data: unknown): BenchReferences | null {
  if (!isObj(data)) return null;
  const { env, benchmarkVersion, engineVersion, generatedAt, seeds, references } = data;
  if ((env !== 'racing' && env !== 'hideseek') || !isNum(benchmarkVersion) || !isNum(engineVersion) || !isNum(seeds)) return null;
  if (typeof generatedAt !== 'string' || !Array.isArray(references) || !references.every(isCurve)) return null;
  const { champions } = data;
  if (champions === undefined) return { env, benchmarkVersion, engineVersion, generatedAt, seeds, references };
  if (!Array.isArray(champions) || !champions.every(isChampion)) return null;
  return { env, benchmarkVersion, engineVersion, generatedAt, seeds, references, champions };
}

/** Where each environment's reference file is served from, under public/. */
export function referencesPath(env: EnvId): string {
  return `/references/${env}.json`;
}

/**
 * Reference curves shipped under public/references, or null if the file
 * cannot be loaded. Runs in the browser and in workers, where the path
 * resolves against the same origin.
 */
export async function loadReferences(env: EnvId): Promise<BenchReferences | null> {
  try {
    const res = await fetch(referencesPath(env));
    if (!res.ok) return null;
    const parsed = parseReferences(await res.json());
    return parsed?.env === env ? parsed : null;
  } catch {
    return null;
  }
}

/** Linear-interpolated quantile of an unsorted list, q from 0 to 1. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Summarizes several seeds' benchmark scores into one curve: the median
 * and the middle half (25% to 75%) at each checkpoint generation. Scores
 * are rounded to a tenth, which keeps the shipped file small.
 *
 * The final score is the median of every seed's scores over the last
 * `finalWindow` checkpoints. One checkpoint is enough for Racing. In Hide
 * and Seek both teams keep chasing each other's latest tricks, so one run
 * can swing 20 points from one checkpoint to the next, and a wider window
 * says where a preset really ends up.
 */
export function summarizeCurve(tier: ReferenceTier, generations: readonly number[], scoresBySeed: readonly (readonly number[])[], finalWindow = 1): ReferenceCurve {
  const curve = generations.map((generation, i) => {
    const at = scoresBySeed.map((s) => s[i]);
    return { generation, median: round1(quantile(at, 0.5)), p25: round1(quantile(at, 0.25)), p75: round1(quantile(at, 0.75)) };
  });
  const from = Math.max(0, generations.length - finalWindow);
  const late = scoresBySeed.flatMap((s) => s.slice(from, generations.length));
  return { tier, finalScore: curve.length ? round1(quantile(late, 0.5)) : 0, curve };
}
