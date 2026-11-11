import { DRIVING_RADAR_AXES } from '../bench/driving/axes';
import type { BlueprintIssue } from '../blueprints/types';
import type { EpisodeEnvInfo } from '../env/episode';
import { DRIVING_BLUEPRINTS } from './blueprints';
import { physicsHash, SUV } from './car/params';
import { DRIVING_METRICS } from './run/metrics';
import { drivingInputsOf } from './run/inputs';
import { DRIVING_LESSONS_INFO } from './run/lessonsInfo';
import type { DrivingInputConfig } from './sensors/inputConfig';
import { builtInInputCount, DRIVING_OUTPUTS, drivingInputSchema } from './sensors/inputSchema';
import { DRIVING_SNAPSHOT } from './snapshotLayout';
import { DRIVING_BENCHMARK_VERSION, DRIVING_ENGINE_VERSION } from './version';

/** Lidar layouts a Driving brain may use. */
export const LIDAR_LIMITS = { minCount: 1, maxCount: 33, minRange: 10, maxRange: 80 } as const;

/** Problems with a Driving sensor config, for the blueprint form and imports. Noise is checked for every env elsewhere. */
function validateDrivingInputs(inputs: unknown): BlueprintIssue[] {
  const cfg = inputs as Partial<DrivingInputConfig>;
  const lidar = cfg.lidar;
  const issues: BlueprintIssue[] = [];
  if (!lidar || !Number.isInteger(lidar.count) || lidar.count < LIDAR_LIMITS.minCount || lidar.count > LIDAR_LIMITS.maxCount) {
    issues.push({ field: 'lidar', message: `Use between ${LIDAR_LIMITS.minCount} and ${LIDAR_LIMITS.maxCount} lidar beams.` });
  } else {
    if (!(lidar.range >= LIDAR_LIMITS.minRange && lidar.range <= LIDAR_LIMITS.maxRange)) issues.push({ field: 'lidar', message: `Lidar range must be ${LIDAR_LIMITS.minRange} to ${LIDAR_LIMITS.maxRange} m.` });
    if (!(lidar.fov >= 0 && lidar.fov <= Math.PI * 2)) issues.push({ field: 'lidar', message: 'The lidar field of view must be 0 to 360 degrees.' });
  }
  return issues;
}

/**
 * Driving's light half: names, layouts, metrics, brains and the input
 * schema. It stays clear of the city, the traffic and the car simulation,
 * which the module adds.
 */
export const drivingInfo = {
  id: 'driving' as const,
  label: 'Driving',
  engineVersion: DRIVING_ENGINE_VERSION,
  tickHz: 30,
  snapshot: DRIVING_SNAPSHOT,
  outputs: DRIVING_OUTPUTS,
  metrics: DRIVING_METRICS,

  blueprints: DRIVING_BLUEPRINTS,
  inputCount: (inputs) => builtInInputCount(inputs as DrivingInputConfig),
  validateInputs: validateDrivingInputs,
  inputSchema: (config, custom = []) => drivingInputSchema(drivingInputsOf(config), SUV, [...custom]),
  physicsHash: (config) => physicsHash(SUV, { inputs: drivingInputsOf(config), engine: DRIVING_ENGINE_VERSION }),

  bench: {
    version: DRIVING_BENCHMARK_VERSION,
    axes: DRIVING_RADAR_AXES,
    hint: 'unseen cities, 0 to 100',
    about: 'Every 5 generations, the champion drives sixteen trips in two cities it never trained in.',
    // Loaded on first use: the exam brings the autopilot and the script compiler, which training without a script never needs.
    run: async (config, genome, opts) => (await import('../bench/driving/runner')).benchmarkDriving(config, genome, opts),
  },

  lessons: DRIVING_LESSONS_INFO,

  load: () => import('./module').then((m) => m.drivingModule),
} satisfies EpisodeEnvInfo;
