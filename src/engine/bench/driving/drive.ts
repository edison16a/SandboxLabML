import type { DrivingLearner } from '../../driving/agent/learner';
import { SUV } from '../../driving/car/params';
import { DrivingEnv } from '../../driving/env';
import type { DrivingResult } from '../../driving/results';
import type { DrivingInputConfig } from '../../driving/sensors/inputConfig';
import { drivingEnvOptions } from '../../driving/setup';
import type { AgentController, CustomSensorSpec, TickIO } from '../../env/types';
import { Network } from '../../neat/network';
import type { Genome } from '../../neat/types';
import type { DrivingExamCourse } from './exam';
import { driveToEnd } from './steps';

/**
 * Seconds without progress before the exam gives up on a trip. Waiting at
 * a red light or behind a car does not count (see DrivingLearner.noProgress),
 * so only a brain that parked for no reason is stopped, and the exam does
 * not spend a whole time limit on it.
 */
export const EXAM_STUCK = 15;

/** The parts of a run the exam needs: the brain's inputs and the script's own sensors, if any. */
export interface DrivingExamDriver {
  inputs: DrivingInputConfig;
  customSensors: CustomSensorSpec[];
  /** Builds the script's controller for a trip. Only its sensors are used. */
  sensorsFor(seed: number, course: DrivingExamCourse, extra: Readonly<Record<string, unknown>>): AgentController<DrivingLearner> | null;
}

/**
 * The exam's controller. It feeds the brain the script's custom sensors,
 * so a brain trained with them sees what it learned with, but it applies
 * the brain's outputs straight to the SUV and never rewards anything. Only
 * the exam's own stuck rule stops a trip early, besides the city's: a
 * crash, a person hit, the curb, a wrong turn or arriving.
 */
function examController(script: AgentController<DrivingLearner> | null): AgentController<DrivingLearner> {
  return {
    customSensorCount: script?.customSensorCount ?? 0,
    sensors(view, out, offset) {
      script?.sensors(view, out, offset);
    },
    tick(l, io: TickIO) {
      io.action[0] = io.brain[0];
      io.action[1] = io.brain[1];
      if (l.noProgress > EXAM_STUCK) io.stop = 'stuck';
    },
  };
}

/** Drives one brain through one exam trip, alone in the city. Null when the signal aborts. */
export async function driveExamCourse(genome: Genome, course: DrivingExamCourse, driver: DrivingExamDriver, seed: number, signal?: AbortSignal): Promise<DrivingResult | null> {
  const probe = drivingEnvOptions(course.setup, SUV, driver.inputs, examController(null));
  const script = driver.sensorsFor(seed, course, { city: probe.city, route: probe.route, level: probe.level });
  const env = new DrivingEnv({ ...probe, controller: examController(script), customSensors: driver.customSensors });
  env.reset([new Network(genome)], [seed]);
  if (!(await driveToEnd(env, signal))) return null;
  return env.results()[0];
}
