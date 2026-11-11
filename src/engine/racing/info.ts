import { RACING_RADAR_AXES } from '../bench/racingAxes';
import { RACING_BLUEPRINTS } from '../blueprints/racingPresets';
import { BENCHMARK_VERSION, ENGINE_VERSION } from '../core/version';
import type { EpisodeEnvInfo } from '../env/episode';
import type { MetricSpec } from '../env/metrics';
import type { RunConfig } from '../training/runConfig';
import { physicsHash } from './car/params';
import type { RacingInputConfig } from './sensors/inputConfig';
import { builtInInputCount, RACING_OUTPUTS, racingInputSchema } from './sensors/inputSchema';
import { RACING_SNAPSHOT } from './snapshot';

const RACING_METRICS: readonly MetricSpec[] = [
  { key: 'distance', label: 'Distance', unit: 'm', source: 'champion', better: 'higher', format: (v) => `${Math.round(v)} m` },
  { key: 'bestLapTime', label: 'Best lap', unit: 's', source: 'champion', better: 'lower', missing: 0, summary: true, format: (v) => (Number.isFinite(v) ? `${v.toFixed(2)} s` : '-') },
];

/** The Racing parts of a run config, or a throw for a run of another env. */
export function racingOf(config: RunConfig) {
  if (!config.racing || config.blueprint.env !== 'racing') throw new Error('Not a racing run');
  return { settings: config.racing, inputs: config.blueprint.inputs };
}

/**
 * Racing's light half: labels, layouts, brains and the input schema. It
 * stays clear of the car and track simulation, which the module adds.
 */
export const racingInfo = {
  id: 'racing' as const,
  label: 'Racing',
  engineVersion: ENGINE_VERSION,
  tickHz: 30,
  snapshot: RACING_SNAPSHOT,
  outputs: RACING_OUTPUTS,
  metrics: RACING_METRICS,

  blueprints: RACING_BLUEPRINTS,
  inputCount: (inputs) => builtInInputCount(inputs as RacingInputConfig),
  inputSchema: (config, custom = []) => {
    const { settings, inputs } = racingOf(config);
    return racingInputSchema(inputs, settings.car, custom);
  },
  physicsHash: (config) => {
    const { settings, inputs } = racingOf(config);
    return physicsHash(settings.car, { inputs });
  },

  bench: {
    version: BENCHMARK_VERSION,
    axes: RACING_RADAR_AXES,
    hint: 'unseen tracks, 0 to 100',
    about: 'Every 5 generations, the champion drives tracks it never trained on.',
    // Loaded on first use: the exam pulls in the script compiler, which training without a script never needs.
    run: async (config, genome, opts) => (await import('../bench/runner')).benchmarkRacing(config, genome, opts),
  },

  load: () => import('./module').then((m) => m.racingModule),
} satisfies EpisodeEnvInfo;
