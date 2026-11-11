import { STATUS_ARRIVED, STATUS_CRASHED, type DrivingLearner } from './agent/learner';

/** Per learner outcome of an episode: fitness plus the numbers the charts, lessons and benchmark read. */
export interface DrivingResult {
  fitness: number;
  /** Meters driven along the route from the start. */
  distance: number;
  /** Share of the trip covered, 0 to 1, and 1 on arrival (the car may stop a few meters short of the zone's middle). */
  completion: number;
  arrived: boolean;
  /** Ended by a crash, a person hit or the curb. */
  crashed: boolean;
  hitPedestrian: boolean;
  stopReason: string | null;
  time: number;
  redLightRuns: number;
  stopLineOverruns: number;
  speedingTime: number;
  laneDepartureTime: number;
  wrongWayTime: number;
  hardBrakes: number;
  /** Seconds with a wheel over the curb (only lenient levels let a car carry on after that). */
  curbTime: number;
  /** Arrived with no crash, no person hit and no red light run. */
  safe: boolean;
  crashX: number;
  crashY: number;
}

export function resultOf(l: DrivingLearner, startS: number, destS: number): DrivingResult {
  const distance = Math.max(0, l.maxProgress - startS);
  const arrived = l.status === STATUS_ARRIVED;
  return {
    fitness: l.fitness,
    distance,
    completion: arrived ? 1 : Math.min(1, distance / Math.max(1, destS - startS)),
    arrived,
    crashed: l.status === STATUS_CRASHED,
    hitPedestrian: l.stopReason === 'pedestrian',
    stopReason: l.stopReason,
    time: l.time,
    redLightRuns: l.redLightRuns,
    stopLineOverruns: l.stopLineOverruns,
    speedingTime: l.speedingTime,
    laneDepartureTime: l.laneDepartureTime,
    wrongWayTime: l.wrongWayTime,
    hardBrakes: l.hardBrakes,
    curbTime: l.curbTime,
    safe: arrived && l.redLightRuns === 0,
    crashX: l.crashX,
    crashY: l.crashY,
  };
}
