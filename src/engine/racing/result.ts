import { STATUS_CRASHED, type RacingCar } from './car/runtime';

/** Per-car outcome of an episode, used for fitness and the champion record. */
export interface RacingResult {
  fitness: number;
  /** Meters driven along the road. */
  distance: number;
  laps: number;
  bestLapTime: number;
  crashed: boolean;
  crashX: number;
  crashY: number;
  stopReason: string | null;
  time: number;
}

export function resultOf(rc: RacingCar): RacingResult {
  return {
    fitness: rc.fitness,
    distance: rc.maxProgress,
    laps: rc.lap,
    bestLapTime: rc.bestLapTime,
    crashed: rc.status === STATUS_CRASHED,
    crashX: rc.crashX,
    crashY: rc.crashY,
    stopReason: rc.stopReason,
    time: rc.time,
  };
}
