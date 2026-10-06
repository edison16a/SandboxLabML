import type { ReferencePoint } from '@/engine/bench/types';

export interface Band {
  p25: number;
  median: number;
  p75: number;
}

/** The reference band at a generation, read off the curve by straight lines between its points and held flat past either end. */
export function bandAt(curve: readonly ReferencePoint[], generation: number): Band | null {
  if (curve.length === 0) return null;
  const sorted = [...curve].sort((a, b) => a.generation - b.generation);
  if (generation <= sorted[0].generation) return sorted[0];
  const last = sorted[sorted.length - 1];
  if (generation >= last.generation) return last;
  const i = sorted.findIndex((p) => p.generation > generation);
  const a = sorted[i - 1];
  const b = sorted[i];
  const t = (generation - a.generation) / (b.generation - a.generation);
  const mix = (x: number, y: number) => x + (y - x) * t;
  return { p25: mix(a.p25, b.p25), median: mix(a.median, b.median), p75: mix(a.p75, b.p75) };
}

/** Standard normal CDF, Abramowitz and Stegun 7.1.26, good to about 1e-7. */
function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + Math.sign(z) * erf);
}

/**
 * Where a score falls among reference runs at the same generation, as a
 * percentile from 1 to 99. The references only ship quartiles, so the
 * spread is assumed to be bell shaped around the median, which is what the
 * interquartile range of a normal distribution gives (IQR = 1.349 sigma).
 */
export function percentileIn(score: number, band: Band): number {
  const sigma = (band.p75 - band.p25) / 1.349;
  if (!(sigma > 1e-9)) return score > band.median ? 99 : score < band.median ? 1 : 50;
  return Math.max(1, Math.min(99, Math.round(normalCdf((score - band.median) / sigma) * 100)));
}
