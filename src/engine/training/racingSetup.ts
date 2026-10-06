import type { RacingInputConfig } from '../racing/sensors/inputConfig';
import type { CarParams } from '../racing/car/params';
import type { TrackSpec } from '../racing/track/types';
import { buildTrack } from '../racing/track/buildTrack';
import { findTrack } from '../racing/track/presets';
import { randomTrackSpec } from '../racing/track/randomTrack';
import type { Track } from '../racing/track/types';
import type { RacingEnvOptions } from '../racing/env';
import type { ScriptHost, TrackDirective } from './scriptHost';
import type { RunConfig } from './runConfig';

/**
 * Everything a worker needs to simulate racing episodes, as plain data that
 * can be posted between threads. Workers rebuild the track and compile the
 * script from this, and cache both by hash.
 */
export interface RacingSetup {
  track: TrackSpec;
  car: CarParams;
  inputs: RacingInputConfig;
  maxTime: number;
  scriptSource: string | null;
  /** Sandbox lesion test, as (input index, forced value) pairs. Never set for training. */
  lesion?: Array<[number, number]>;
}

export function racingSetupFor(config: RunConfig, track: TrackSpec, scriptSource: string | null): RacingSetup {
  if (config.env !== 'racing' || !config.racing || config.blueprint.env !== 'racing') throw new Error('Not a racing run');
  return { track, car: config.racing.car, inputs: config.blueprint.inputs, maxTime: config.racing.maxTime, scriptSource };
}

export function resolveTrackDirective(d: TrackDirective, width: number): TrackSpec {
  if (d.kind === 'random') return randomTrackSpec(d.seed, width);
  return findTrack(d.id) ?? randomTrackSpec(1, width);
}

/** Environment options for a setup. The controller is created per episode so script `rand()` is seeded per car. */
export function envOptionsFor(setup: RacingSetup, track: Track, host: ScriptHost, seed: number): RacingEnvOptions {
  return {
    track,
    car: setup.car,
    inputs: setup.inputs,
    maxTime: setup.maxTime,
    controller: host.createRacingController(seed, track),
    customSensors: host.customSensors,
    lesion: setup.lesion,
  };
}

/** Small cache so workers do not rebuild the same track for every batch. */
export class TrackCache {
  private readonly tracks = new Map<string, Track>();
  get(spec: TrackSpec): Track {
    const key = JSON.stringify([spec.points, spec.width]);
    let t = this.tracks.get(key);
    if (!t) {
      t = buildTrack(spec);
      if (this.tracks.size > 8) this.tracks.clear();
      this.tracks.set(key, t);
    }
    return t;
  }
}
