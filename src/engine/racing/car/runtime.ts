import { SIM_DT } from './params';
import { createCar, type CarState } from './dynamics';
import { gridSlot, slotPose } from './startGrid';
import { nearestSample, project, type TrackPosition } from '../track/locate';
import type { Track } from '../track/types';
import { trackHeading } from '../track/buildTrack';
import { wrapAngle } from '../../core/math';

export const STATUS_DRIVING = 0;
export const STATUS_CRASHED = 1;
export const STATUS_STOPPED = 2;

/** Extra space between the white edge line and the barrier, m. */
export const RUNOFF = 2;

/**
 * One car in an episode: physics state plus everything scripts can read
 * (progress, laps, events of the last step). Scripts compile to direct field
 * reads on this object, which keeps them fast.
 */
export interface RacingCar {
  index: number;
  /**
   * Per-car seed (from run seed, generation and genome id). Sensor noise and
   * script rand() derive from it rather than from the car's index, so a ghost
   * replayed alone draws the same numbers it drew in its generation.
   */
  seed: number;
  car: CarState;
  pos: TrackPosition;
  /** Meters driven along the centerline since the start, negative if backwards. */
  progress: number;
  maxProgress: number;
  checkpointsPassed: number;
  /** Events from the most recent physics step. */
  checkpointPassed: boolean;
  lapCompleted: boolean;
  lap: number;
  lapTime: number;
  lastLapTime: number;
  bestLapTime: number;
  offTrack: boolean;
  hitBarrier: boolean;
  /** Seconds since progress last increased. */
  noProgress: number;
  time: number;
  headingError: number;
  /** Distance along the road to the next checkpoint, m. */
  checkpointDistance: number;
  rays: Float64Array;
  status: number;
  stopReason: string | null;
  fitness: number;
  crashX: number;
  crashY: number;
}

/**
 * A car on the grid, ready to go. Training only ever uses slot 0, the start
 * line itself. The Sandbox lines extra cars up behind it, and those start
 * with negative progress so their first lap counts from the line like
 * everyone else's.
 */
export function createRacingCar(index: number, track: Track, rayCount: number, seed = index, slot = 0): RacingCar {
  const grid = gridSlot(track, slot);
  const start = slotPose(track, grid);
  const car = createCar(start.x, start.y, start.heading);
  const pos: TrackPosition = { index: grid.index, s: track.s[grid.index], lateral: grid.lateral };
  return {
    index,
    seed,
    car,
    pos,
    progress: 0 - grid.back,
    maxProgress: 0 - grid.back,
    checkpointsPassed: 0,
    checkpointPassed: false,
    lapCompleted: false,
    lap: 0,
    lapTime: 0,
    lastLapTime: 0,
    bestLapTime: 0,
    offTrack: false,
    hitBarrier: false,
    noProgress: 0,
    time: 0,
    headingError: 0,
    checkpointDistance: track.spacing * (track.checkpoints[1] ?? 10) + grid.back,
    rays: new Float64Array(rayCount),
    status: STATUS_DRIVING,
    stopReason: null,
    fitness: 0,
    crashX: 0,
    crashY: 0,
  };
}

/** Distance along the track of global checkpoint j (j counts across laps). */
function checkpointProgress(track: Track, j: number): number {
  const per = track.checkpoints.length;
  const lap = Math.floor(j / per);
  return lap * track.length + track.s[track.checkpoints[j % per]];
}

/**
 * Updates track-relative state after a physics step: progress, checkpoints,
 * laps, off-track flags and the stall timer.
 */
export function updateTrackState(rc: RacingCar, track: Track): void {
  const oldS = rc.pos.s;
  const idx = nearestSample(track, rc.car.x, rc.car.y, rc.pos.index);
  project(track, rc.car.x, rc.car.y, idx, rc.pos);
  let ds = rc.pos.s - oldS;
  if (ds > track.length / 2) ds -= track.length;
  else if (ds < -track.length / 2) ds += track.length;
  rc.progress += ds;
  rc.time += SIM_DT;
  rc.lapTime += SIM_DT;

  rc.checkpointPassed = false;
  rc.lapCompleted = false;
  const per = track.checkpoints.length;
  while (rc.progress >= checkpointProgress(track, rc.checkpointsPassed + 1)) {
    rc.checkpointsPassed++;
    rc.checkpointPassed = true;
    if (rc.checkpointsPassed % per === 0) {
      rc.lap++;
      rc.lapCompleted = true;
      rc.lastLapTime = rc.lapTime;
      rc.bestLapTime = rc.bestLapTime > 0 ? Math.min(rc.bestLapTime, rc.lapTime) : rc.lapTime;
      rc.lapTime = 0;
    }
  }
  rc.checkpointDistance = checkpointProgress(track, rc.checkpointsPassed + 1) - rc.progress;

  if (rc.progress > rc.maxProgress + 0.05) {
    rc.maxProgress = rc.progress;
    rc.noProgress = 0;
  } else {
    rc.noProgress += SIM_DT;
  }
  const lateral = Math.abs(rc.pos.lateral);
  rc.offTrack = lateral > track.halfWidth;
  rc.hitBarrier = lateral > track.halfWidth + RUNOFF;
  rc.headingError = wrapAngle(rc.car.heading - trackHeading(track, rc.pos.index));
}

export function stopCar(rc: RacingCar, reason: string): void {
  if (rc.status !== STATUS_DRIVING) return;
  rc.stopReason = reason;
  rc.status = reason === 'crash' ? STATUS_CRASHED : STATUS_STOPPED;
  if (rc.status === STATUS_CRASHED) {
    rc.crashX = rc.car.x;
    rc.crashY = rc.car.y;
  }
  rc.car.speed = 0;
}
