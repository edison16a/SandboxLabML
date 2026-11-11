import type { NavigationRadar } from './axes';

/**
 * How much each part counts toward the 0 to 100 score. Getting there
 * matters most; staying alive, getting there quickly and doing it in
 * every kind of room share the rest. Changing anything in this file
 * changes scores, so bump NAVIGATION_BENCHMARK_VERSION.
 */
export const WEIGHTS = { completion: 0.4, safety: 0.2, efficiency: 0.2, generalization: 0.2 } as const;

/** What one exam run left behind. */
export interface ExamRun {
  /** Best share of its walk covered, 0 to 1. A finish is 1. */
  progress: number;
  finished: boolean;
  died: boolean;
  /** Seconds to the line, or 0 without a finish. */
  finishTime: number;
  /** The perfect navigator's time from the same spot, s. */
  par: number;
  /** The room had spikes or movers. */
  hazards: boolean;
}

/** One run scored on the per run axes, each 0 to 1. Safety is null in a room with nothing that kills. */
export interface RunScore {
  completion: number;
  safety: number | null;
  efficiency: number;
}

const clamp01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Completion is the share of the walk covered. Safety, only in rooms with
 * hazards, keeps that share unless the runner died: standing still at the
 * start is not safe, it is nothing. Efficiency compares a finish with the
 * scripted navigator's time, so 1 means navigator pace, and a run without
 * a finish gets none.
 */
export function scoreRun(r: ExamRun): RunScore {
  const completion = r.finished ? 1 : clamp01(r.progress);
  return {
    completion,
    safety: r.hazards ? (r.died ? 0 : completion) : null,
    efficiency: r.finished && r.finishTime > 0 ? clamp01(r.par / r.finishTime) : 0,
  };
}

/** Axis averages of a group of runs. Safety averages the runs that have it, and is null when none do. */
export function averageRuns(scores: RunScore[]): RunScore {
  const safe = scores.flatMap((s) => (s.safety === null ? [] : [s.safety]));
  return { completion: mean(scores.map((s) => s.completion)), safety: safe.length ? mean(safe) : null, efficiency: mean(scores.map((s) => s.efficiency)) };
}

/** A level's own 0 to 100 score: the composite without generalization, and without safety where nothing can kill. */
export function partScore(s: RunScore): number {
  const w = WEIGHTS.completion + WEIGHTS.efficiency + (s.safety === null ? 0 : WEIGHTS.safety);
  return (100 * (WEIGHTS.completion * s.completion + WEIGHTS.efficiency * s.efficiency + WEIGHTS.safety * (s.safety ?? 0))) / w;
}

/**
 * The radar and the score from every run, grouped by level.
 * Generalization is the completion on the weakest level, so a brain that
 * only learned open floors scores low there even if it flies through
 * them.
 */
export function composite(byLevel: RunScore[][]): { radar: NavigationRadar; score: number } {
  const all = averageRuns(byLevel.flat());
  const radar: NavigationRadar = {
    completion: all.completion,
    safety: all.safety ?? 0,
    efficiency: all.efficiency,
    generalization: byLevel.length ? Math.min(...byLevel.map((runs) => averageRuns(runs).completion)) : 0,
  };
  const score = 100 * (WEIGHTS.completion * radar.completion + WEIGHTS.safety * radar.safety + WEIGHTS.efficiency * radar.efficiency + WEIGHTS.generalization * radar.generalization);
  return { radar, score };
}
