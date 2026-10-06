import type { RacingRadar } from './types';
import type { EpisodeResult } from './drive';
import type { ExamCourse } from './exam';

/**
 * How much each part counts toward the 0 to 100 score. Completion matters
 * most, because a fast car that crashes is not a good driver. Changing any
 * constant in this file changes scores, so bump BENCHMARK_VERSION.
 */
export const WEIGHTS = { completion: 0.4, speed: 0.3, smoothness: 0.15, generalization: 0.15 } as const;

/** Share of completion a car keeps when it ends its run in the barrier. */
export const CRASH_KEEP = 0.7;

/** Mean steering change per tick that counts as fully jerky. Smooth drivers stay far below it. */
export const STEER_JERK = 0.1;

/** One episode scored on the three per-episode axes, each from 0 to 1. */
export interface EpisodeScore {
  completion: number;
  speed: number;
  smoothness: number;
}

const clamp01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);

/**
 * Completion is the share of one lap driven, with a cut for hitting the
 * barrier. Speed compares the best lap with the scripted driver's, and a
 * car without a full lap gets its average speed against par, scaled by how
 * much of the lap it covered, so crashing early at full throttle earns
 * little. Smoothness is scaled the same way: a car that goes nowhere has
 * nothing to be smooth about.
 */
export function scoreEpisode(r: EpisodeResult, course: ExamCourse): EpisodeScore {
  const length = course.track.length;
  const progress = clamp01(r.distance / length);
  const completion = progress * (r.crashed ? CRASH_KEEP : 1);
  const parSpeed = length / course.par.lapTime;
  const speed = r.laps > 0 && r.bestLapTime > 0 ? clamp01(course.par.lapTime / r.bestLapTime) : r.time > 0 ? clamp01(r.distance / r.time / parSpeed) * progress : 0;
  const smoothness = (1 - clamp01(r.steerChange / STEER_JERK)) * progress;
  return { completion, speed, smoothness };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The average of several episode scores, axis by axis. */
export function averageScores(scores: EpisodeScore[]): EpisodeScore {
  return {
    completion: mean(scores.map((s) => s.completion)),
    speed: mean(scores.map((s) => s.speed)),
    smoothness: mean(scores.map((s) => s.smoothness)),
  };
}

/** A track's own 0 to 100 score: the composite without the cross-track part. */
export function trackScore(s: EpisodeScore): number {
  const w = WEIGHTS.completion + WEIGHTS.speed + WEIGHTS.smoothness;
  return (100 * (WEIGHTS.completion * s.completion + WEIGHTS.speed * s.speed + WEIGHTS.smoothness * s.smoothness)) / w;
}

/**
 * The radar and the composite score. Generalization is the completion on
 * the weakest road, so a brain that only learned how to drive one kind of
 * road scores low here even if it is brilliant on the others.
 */
export function composite(perTrack: EpisodeScore[]): { radar: RacingRadar; score: number } {
  const all = averageScores(perTrack);
  const radar: RacingRadar = {
    completion: all.completion,
    speed: all.speed,
    smoothness: all.smoothness,
    generalization: perTrack.length ? Math.min(...perTrack.map((s) => s.completion)) : 0,
  };
  const score = 100 * (WEIGHTS.completion * radar.completion + WEIGHTS.speed * radar.speed + WEIGHTS.smoothness * radar.smoothness + WEIGHTS.generalization * radar.generalization);
  return { radar, score };
}
