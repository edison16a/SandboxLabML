import { RACING_RADAR_AXES } from '../bench/racingAxes';
import { BENCHMARK_VERSION, ENGINE_VERSION } from '../core/version';
import type { EpisodeEnvModule } from '../env/episode';
import type { MetricSpec } from '../env/metrics';
import { RACING_BLUEPRINTS } from '../blueprints/racingPresets';
import type { RacingChampionRecord } from '../training/records';
import { envOptionsFor, racingSetupFor, resolveTrackDirective, TrackCache, type RacingSetup } from '../training/racingSetup';
import { physicsHash } from './car/params';
import { RacingEnv, RACING_SNAPSHOT } from './env';
import type { RacingResult } from './result';
import type { RacingInputConfig } from './sensors/inputConfig';
import { builtInInputCount, RACING_OUTPUTS, racingInputSchema } from './sensors/inputSchema';
import type { TrackSpec } from './track/types';

/** Built tracks by spec, shared by every episode this thread runs, so a batch never rebuilds the road. */
const tracks = new TrackCache();

const RACING_METRICS: readonly MetricSpec[] = [
  { key: 'distance', label: 'Distance', unit: 'm', source: 'champion', better: 'higher', format: (v) => `${Math.round(v)} m` },
  { key: 'bestLapTime', label: 'Best lap', unit: 's', source: 'champion', better: 'lower', missing: 0, format: (v) => (Number.isFinite(v) ? `${v.toFixed(2)} s` : '-') },
];

function racingOf(config: Parameters<EpisodeEnvModule['initialContent']>[0]) {
  if (!config.racing || config.blueprint.env !== 'racing') throw new Error('Not a racing run');
  return { settings: config.racing, inputs: config.blueprint.inputs };
}

/**
 * Racing as an episode env: the content is the track, which the script's
 * generation block may switch with useTrack. A switch to a different road
 * resets the stagnation count, since scores on two roads do not compare.
 */
export const racingModule: EpisodeEnvModule<RacingSetup, TrackSpec, RacingResult, RacingChampionRecord> = {
  id: 'racing',
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

  initialContent: (config) => racingOf(config).settings.track,
  nextContent: ({ content, directives }) => {
    const wanted = directives.racing?.track;
    if (!wanted) return null;
    const spec = resolveTrackDirective(wanted, content.width);
    return tracks.get(spec).hash === tracks.get(content).hash ? null : { content: spec, reset: true };
  },
  contentHash: (spec) => tracks.get(spec).hash,
  createSetup: ({ config, content, scriptSource }) => racingSetupFor(config, content, scriptSource),
  createEnv: (setup, host, seed) => new RacingEnv(envOptionsFor(setup, tracks.get(setup.track), host, seed)),

  championFields: (r) => ({ distance: r.distance, laps: r.laps, bestLapTime: r.bestLapTime, crashed: r.crashed, crashX: r.crashX, crashY: r.crashY }),

  telemetry: {
    // Racing builds every episode as a RacingEnv, so the cast only names what createEnv returned.
    sample: (env, i, out) => {
      const rc = (env as RacingEnv).cars[i];
      out[0] = rc.progress;
      out[1] = rc.car.speed;
      out[2] = Math.max(0, -rc.car.pedal);
    },
    crash: (r) => (r.crashed ? { x: r.crashX, y: r.crashY } : null),
  },

  bench: {
    version: BENCHMARK_VERSION,
    axes: RACING_RADAR_AXES,
    hint: 'unseen tracks, 0 to 100',
    about: 'Every 5 generations, the champion drives tracks it never trained on.',
    // Loaded on first use: the exam pulls in the script compiler, which training without a script never needs.
    run: async (config, genome, opts) => (await import('../bench/runner')).benchmarkRacing(config, genome, opts),
  },
};
