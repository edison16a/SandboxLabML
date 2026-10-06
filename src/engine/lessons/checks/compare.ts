import type { CheckOutcome } from '../types';

export type CompareOp = '>' | '>=' | '<' | '<=' | '==';

/**
 * Compares a measured value with a target. Equality allows a tiny
 * tolerance, since rewards add up in floating point and 0.1 + 0.2 should
 * still count as 0.3 for a learner.
 */
export function compare(measured: number, op: CompareOp, target: number): boolean {
  switch (op) {
    case '>':
      return measured > target;
    case '>=':
      return measured >= target;
    case '<':
      return measured < target;
    case '<=':
      return measured <= target;
    case '==':
      return Math.abs(measured - target) <= 1e-9 * Math.max(1, Math.abs(target));
  }
}

/** Human wording for each metric value, so outcomes read "182 m" rather than "182.3349". */
const FORMATS: Record<string, (v: number) => string> = {
  totalReward: (v) => `${round(v)} points`,
  bestFitness: (v) => `${round(v)} points`,
  distance: (v) => `${Math.round(v)} m`,
  bestDistance: (v) => `${Math.round(v)} m`,
  laps: (v) => `${v} ${v === 1 ? 'lap' : 'laps'}`,
  ticks: (v) => `${v} ticks (${(v / 30).toFixed(1)} s)`,
  crashed: (v) => (v ? 'the car crashed' : 'the car did not crash'),
  checkpoints: (v) => `${v} ${v === 1 ? 'checkpoint' : 'checkpoints'}`,
  inputs: (v) => `${v} brain inputs`,
  species: (v) => `${v} species`,
};

function round(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** A measured metric in plain words. */
export function formatMetric(metric: string, value: number): string {
  return (FORMATS[metric] ?? round)(value);
}

/** The outcome for a metric comparison, with the measured value spelled out either way. */
export function metricOutcome(metric: string, measured: number, op: CompareOp, target: number, message: string, what: string): CheckOutcome {
  const passed = compare(measured, op, target);
  const value = formatMetric(metric, measured);
  return passed
    ? { passed, measured, message: `Passed. ${what}: ${value}.` }
    : { passed, measured, message: `${message} ${what}: ${value}.` };
}
