import type { EpisodeEnvModule } from '../env/episode';
import type { RacingChampionRecord } from '../training/records';
import { envOptionsFor, racingSetupFor, resolveTrackDirective, TrackCache, type RacingSetup } from '../training/racingSetup';
import { RacingEnv } from './env';
import { racingInfo, racingOf } from './info';
import type { RacingResult } from './result';
import type { TrackSpec } from './track/types';

/** Built tracks by spec, shared by every episode this thread runs, so a batch never rebuilds the road. */
const tracks = new TrackCache();

/**
 * Racing as an episode env: the content is the track, which the script's
 * generation block may switch with useTrack. A switch to a different road
 * resets the stagnation count, since scores on two roads do not compare.
 */
export const racingModule: EpisodeEnvModule<RacingSetup, TrackSpec, RacingResult, RacingChampionRecord> = {
  ...racingInfo,

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
};
