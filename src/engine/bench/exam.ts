import { stepCar } from '../racing/car/dynamics';
import { DEFAULT_CAR } from '../racing/car/params';
import { createRacingCar, updateTrackState } from '../racing/car/runtime';
import { scriptedDriver } from '../racing/scriptedDriver';
import { buildTrack } from '../racing/track/buildTrack';
import type { Track } from '../racing/track/types';
import { startAt } from './startOffset';
import { BENCH_EPISODE_SECONDS, BENCH_STARTS, benchTrackSpecs } from './tracks';

/** What the scripted driver manages on one course. Speed is scored against it, so 100% means its pace. */
export interface Par {
  /** Best lap time within the episode, s. */
  lapTime: number;
  /** Meters along the road at the end of the episode. */
  distance: number;
}

/** One exam episode's road: a track with its start line moved. */
export interface ExamCourse {
  start: number;
  track: Track;
  par: Par;
}

export interface ExamTrack {
  id: string;
  label: string;
  courses: ExamCourse[];
}

/**
 * Drives the scripted driver for a full episode. It knows the road
 * perfectly, so its laps are the pace an evolved brain is measured
 * against. Like the exam itself, it only stops at the barrier or on time.
 */
export function parFor(track: Track, seconds = BENCH_EPISODE_SECONDS): Par {
  const rc = createRacingCar(0, track, 0);
  const act = new Float64Array(2);
  while (rc.time < seconds - 1e-9 && !rc.hitBarrier) {
    stepCar(rc.car, act[0], act[1], DEFAULT_CAR);
    updateTrackState(rc, track);
    scriptedDriver(rc, track, DEFAULT_CAR, act);
  }
  return { lapTime: rc.bestLapTime, distance: rc.maxProgress };
}

let cached: ExamTrack[] | null = null;

/**
 * The whole exam: five roads with three starts each, plus par for every
 * course. Building it takes a few milliseconds, so it is made once per
 * thread and shared. Everything in it is derived from fixed data, so every
 * thread builds the same exam.
 */
export function examTracks(): ExamTrack[] {
  cached ??= benchTrackSpecs().map((spec) => {
    const base = buildTrack(spec);
    const courses = BENCH_STARTS.map((start) => {
      const track = startAt(base, start);
      return { start, track, par: parFor(track) };
    });
    return { id: spec.id, label: spec.name, courses };
  });
  return cached;
}
