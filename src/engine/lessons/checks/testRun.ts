import { blueprintShape } from '../../blueprints/shape';
import { Network } from '../../neat/network';
import { DEFAULT_CAR, SIM_DT } from '../../racing/car/params';
import { STATUS_CRASHED } from '../../racing/car/runtime';
import { RacingEnv } from '../../racing/env';
import { buildTrack } from '../../racing/track/buildTrack';
import type { PreparedScript } from '../prepare';
import { TEST_BRAIN_SEED, testDriverGenome } from '../testDriver';
import type { CheckOutcome, LessonCheck } from '../types';
import { metricOutcome } from './compare';

type TestRunCheck = Extract<LessonCheck, { kind: 'testRun' }>;

/** Length of a test drive, s. The same minute a new run gives each car. */
export const TEST_DRIVE_SECONDS = 60;

/** What one test drive measured. Every value is a plain number so checks can compare any of them. */
export type TestDriveMetrics = Record<'totalReward' | 'distance' | 'laps' | 'ticks' | 'crashed' | 'checkpoints' | 'inputs', number>;

export const TEST_DRIVE_METRICS: readonly (keyof TestDriveMetrics)[] = ['totalReward', 'distance', 'laps', 'ticks', 'crashed', 'checkpoints', 'inputs'];

/**
 * One car, one episode, on the script's track, driven by the fixed test
 * brain. The script's own controller runs every tick, so its drive call,
 * rewards and stop rules are exactly what the car lives by.
 */
export function testDrive(prepared: PreparedScript): TestDriveMetrics {
  const blueprint = prepared.blueprint;
  if (!blueprint) throw new Error('Test drives need a racing brain.');
  const track = buildTrack(prepared.track);
  const sensors = prepared.script.sensors;
  const env = new RacingEnv({
    track,
    car: DEFAULT_CAR,
    inputs: blueprint.inputs,
    controller: prepared.script.createController({ seed: TEST_BRAIN_SEED, track }),
    maxTime: TEST_DRIVE_SECONDS,
    customSensors: sensors,
  });
  const genome = testDriverGenome(blueprintShape(blueprint, sensors.length), env.inputSchema());
  env.reset([new Network(genome)], [TEST_BRAIN_SEED]);
  while (!env.done) env.step();
  const rc = env.cars[0];
  return {
    totalReward: rc.fitness,
    distance: rc.maxProgress,
    laps: rc.lap,
    ticks: Math.round(rc.time / SIM_DT),
    crashed: rc.status === STATUS_CRASHED ? 1 : 0,
    checkpoints: rc.checkpointsPassed,
    inputs: env.inputCount,
  };
}

/** Runs a testRun check. Unknown metrics fail with a message that names the ones that exist. */
export function testRunCheck(check: TestRunCheck, prepared: PreparedScript): CheckOutcome {
  if (!prepared.blueprint) return { passed: false, message: 'Test drives need a racing brain, such as brain racing-starter.' };
  if (!(TEST_DRIVE_METRICS as readonly string[]).includes(check.metric)) {
    return { passed: false, message: `A test drive cannot measure ${check.metric}. It measures ${TEST_DRIVE_METRICS.join(', ')}.` };
  }
  const measured = testDrive(prepared)[check.metric as keyof TestDriveMetrics];
  return metricOutcome(check.metric, measured, check.op, check.value, check.message, 'Test drive');
}
