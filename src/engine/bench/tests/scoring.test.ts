import { describe, expect, it } from 'vitest';
import type { EpisodeResult } from '../drive';
import { examTracks } from '../exam';
import { composite, CRASH_KEEP, scoreEpisode, STEER_JERK, trackScore, WEIGHTS } from '../scoring';

const course = examTracks()[0].courses[0];
const lap = course.track.length;

function episode(overrides: Partial<EpisodeResult>): EpisodeResult {
  return { laps: 0, bestLapTime: 0, distance: 0, time: 60, crashed: false, steerChange: 0, ...overrides };
}

describe('scoreEpisode', () => {
  it('gives a parked car nothing, not even smoothness', () => {
    expect(scoreEpisode(episode({}), course)).toEqual({ completion: 0, speed: 0, smoothness: 0 });
  });

  it('gives par pace full marks and cuts completion for a crash', () => {
    const clean = scoreEpisode(episode({ laps: 2, bestLapTime: course.par.lapTime, distance: 2 * lap }), course);
    expect(clean).toEqual({ completion: 1, speed: 1, smoothness: 1 });
    const crashed = scoreEpisode(episode({ laps: 1, bestLapTime: course.par.lapTime * 2, distance: 1.5 * lap, crashed: true }), course);
    expect(crashed.completion).toBeCloseTo(CRASH_KEEP);
    expect(crashed.speed).toBeCloseTo(0.5);
  });

  it('scales the speed of an unfinished lap by how much of it was driven', () => {
    const parSpeed = lap / course.par.lapTime;
    const fastCrash = scoreEpisode(episode({ distance: lap / 4, time: lap / 4 / parSpeed, crashed: true }), course);
    expect(fastCrash.speed).toBeCloseTo(0.25);
    expect(fastCrash.completion).toBeCloseTo(0.25 * CRASH_KEEP);
  });

  it('marks jerky steering down', () => {
    const half = scoreEpisode(episode({ laps: 1, bestLapTime: 60, distance: lap, steerChange: STEER_JERK / 2 }), course);
    expect(half.smoothness).toBeCloseTo(0.5);
    const jerky = scoreEpisode(episode({ laps: 1, bestLapTime: 60, distance: lap, steerChange: 2 }), course);
    expect(jerky.smoothness).toBe(0);
  });
});

describe('composite', () => {
  it('uses weights that add up to one', () => {
    const sum = WEIGHTS.completion + WEIGHTS.speed + WEIGHTS.smoothness + WEIGHTS.generalization;
    expect(sum).toBeCloseTo(1, 12);
  });

  it('scores a perfect exam 100 and judges generalization by the weakest road', () => {
    const perfect = { completion: 1, speed: 1, smoothness: 1 };
    expect(composite([perfect, perfect]).score).toBeCloseTo(100);
    expect(trackScore(perfect)).toBeCloseTo(100);
    const lopsided = composite([perfect, { completion: 0.2, speed: 0.2, smoothness: 0.2 }]);
    expect(lopsided.radar.generalization).toBeCloseTo(0.2);
    expect(lopsided.radar.completion).toBeCloseTo(0.6);
  });
});
