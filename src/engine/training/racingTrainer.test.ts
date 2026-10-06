import { describe, expect, it } from 'vitest';
import { RACING_BLUEPRINTS } from '../blueprints/presets';
import { evaluateRacing } from '../racing/episode';
import { BUILT_IN_TRACKS } from '../racing/track/presets';
import { envOptionsFor, TrackCache } from './racingSetup';
import { RacingTrainer } from './racingTrainer';
import { createRacingRunConfig } from './runConfig';

function config() {
  return createRacingRunConfig({
    name: 'test',
    seed: 11,
    blueprint: RACING_BLUEPRINTS[2],
    track: BUILT_IN_TRACKS[0],
    carPreset: 'standard',
    populationSize: 40,
  });
}

function runGeneration(t: RacingTrainer, cache: TrackCache) {
  const setup = t.setup();
  const track = cache.get(setup.track);
  const seeds = t.seeds();
  const results = evaluateRacing(t.genomes, envOptionsFor(setup, track, t.host(), 0), seeds);
  return t.complete(results, 0);
}

describe('RacingTrainer', () => {
  it('produces records with a champion and rising best fitness', () => {
    const t = new RacingTrainer(config());
    const cache = new TrackCache();
    const records = Array.from({ length: 6 }, () => runGeneration(t, cache));
    expect(records.map((r) => r.generation)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(records[5].stats.best).toBeGreaterThanOrEqual(records[0].stats.best);
    expect(records[0].champion.distance).toBeGreaterThan(0);
  });

  it('resumes from a checkpoint with identical results', () => {
    const cache = new TrackCache();
    const a = new RacingTrainer(config());
    for (let i = 0; i < 3; i++) runGeneration(a, cache);
    const b = new RacingTrainer(a.config, structuredClone(a.toState()));
    for (let i = 0; i < 3; i++) {
      const ra = runGeneration(a, cache);
      const rb = runGeneration(b, cache);
      expect(rb.stats).toEqual(ra.stats);
      expect(rb.champion).toEqual(ra.champion);
    }
  });
});
