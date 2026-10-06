import type { AgentController, TickIO } from '../env/types';
import { Network } from '../neat/network';
import type { Genome } from '../neat/types';
import { DEFAULT_CAR } from '../racing/car/params';
import { STATUS_CRASHED, type RacingCar } from '../racing/car/runtime';
import { RacingEnv } from '../racing/env';
import type { RacingInputConfig } from '../racing/sensors/inputConfig';
import type { CustomSensorSpec } from '../racing/sensors/inputSchema';
import type { ExamCourse } from './exam';
import { BENCH_EPISODE_SECONDS } from './tracks';

/** Raw numbers from one exam episode. Scoring turns them into shares of par. */
export interface EpisodeResult {
  laps: number;
  /** Best lap, s, or 0 without a full lap. */
  bestLapTime: number;
  /** Meters along the road. */
  distance: number;
  /** Seconds driven before the barrier or the clock stopped the car. */
  time: number;
  crashed: boolean;
  /** Mean absolute change of the steering command per tick, 0 to 2. */
  steerChange: number;
}

/** The parts of a run the exam needs: the brain's inputs and the script's own sensors, if any. */
export interface ExamDriver {
  inputs: RacingInputConfig;
  customSensors: CustomSensorSpec[];
  /** Builds the script's controller for a course. Only its sensors are used. */
  sensorsFor(seed: number, course: ExamCourse): AgentController<RacingCar> | null;
}

/**
 * The exam's controller. It feeds the brain the script's custom sensors,
 * so a brain trained with them sees what it learned with, but it applies
 * the brain's outputs straight to the car and never rewards or stops
 * anything. Training rewards cannot change an exam score.
 */
function examController(script: AgentController<RacingCar> | null, steer: { last: number; sum: number; ticks: number }): AgentController<RacingCar> {
  return {
    customSensorCount: script?.customSensorCount ?? 0,
    sensors(view, out, offset) {
      script?.sensors(view, out, offset);
    },
    tick(_view, io: TickIO) {
      const s = io.brain[0];
      io.action[0] = s;
      io.action[1] = io.brain[1];
      if (steer.ticks > 0) steer.sum += Math.abs(s - steer.last);
      steer.last = s;
      steer.ticks++;
    },
  };
}

/** Drives one brain through one course with the standard car, until the barrier or the clock. */
export function driveCourse(genome: Genome, course: ExamCourse, driver: ExamDriver, seed: number): EpisodeResult {
  const steer = { last: 0, sum: 0, ticks: 0 };
  const env = new RacingEnv({
    track: course.track,
    car: DEFAULT_CAR,
    inputs: driver.inputs,
    controller: examController(driver.sensorsFor(seed, course), steer),
    maxTime: BENCH_EPISODE_SECONDS,
    customSensors: driver.customSensors,
  });
  env.reset([new Network(genome)], [seed]);
  while (!env.done) env.step();
  const rc = env.cars[0];
  return {
    laps: rc.lap,
    bestLapTime: rc.bestLapTime,
    distance: Math.max(0, rc.maxProgress),
    time: rc.time,
    crashed: rc.status === STATUS_CRASHED,
    steerChange: steer.ticks > 1 ? steer.sum / (steer.ticks - 1) : 0,
  };
}
