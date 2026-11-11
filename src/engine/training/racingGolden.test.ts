import { describe, expect, it } from 'vitest';
import { RACING_BLUEPRINTS } from '../blueprints/presets';
import { hashObject } from '../core/hash';
import { mixSeed } from '../core/rng';
import { linkScriptCompiler } from '../lessons/compilerLink';
import { evaluateRacing } from '../racing/episode';
import { BUILT_IN_TRACKS } from '../racing/track/presets';
import { compileScript } from '../script/compiler';
import { envOptionsFor, TrackCache } from './racingSetup';
import { RacingTrainer } from './racingTrainer';
import { createRacingRunConfig } from './runConfig';

/** Switches tracks after two generations, so the golden run also covers a script directive. */
const SCRIPT = `script "Golden" for racing v1
brain racing-standard
each tick {
  drive(steer: brain.steer, pedal: brain.pedal)
  reward +0.002 * car.speed
  reward +1 when checkpoint.passed
  stop "crash" when car.offTrack
  stop "stalled" when car.noProgress > 3 s
}
each generation {
  speciate(target: 4)
  if generation == 2 {
    useTrack(id: "sprint")
  }
}
`;

function train(script: boolean): { hash: string; tracks: number } {
  linkScriptCompiler();
  const compiled = compileScript(SCRIPT).script!;
  const config = createRacingRunConfig({
    name: 'golden',
    seed: 77,
    blueprint: RACING_BLUEPRINTS[2],
    track: BUILT_IN_TRACKS[0],
    carPreset: 'standard',
    populationSize: 30,
    maxTime: 20,
    script: script ? { source: SCRIPT, hash: compiled.sourceHash, customSensors: 0 } : undefined,
  });
  const t = new RacingTrainer({ ...config, id: 'golden', createdAt: 0 });
  const cache = new TrackCache();
  const records = [];
  for (let g = 0; g < 5; g++) {
    const setup = t.setup();
    const opts = envOptionsFor(setup, cache.get(setup.track), t.host(), mixSeed(t.generation, 0x51));
    records.push(t.complete(evaluateRacing(t.genomes, opts, t.seeds()), 0));
  }
  // The state is hashed in its pre refactor layout, which kept the track under `track`.
  const { content, ...state } = t.toState();
  return { hash: hashObject({ records, state: { ...state, track: content } }), tracks: new Set(records.map((r) => r.trackHash)).size };
}

/**
 * Racing training must stay bit for bit what it was before the generic
 * pipeline existed. These hashes were taken from the code before the
 * refactor; any change to them means Racing results changed.
 */
describe('Racing training golden run', () => {
  it('matches the pre refactor results with the built in reward', () => {
    expect(train(false)).toEqual({ hash: '63507ee9', tracks: 1 });
  });

  it('matches the pre refactor results with a script that switches tracks', () => {
    expect(train(true)).toEqual({ hash: 'c815b4f6', tracks: 2 });
  });
});
