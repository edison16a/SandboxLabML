import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../../neat/population';
import { DEFAULT_NEAT } from '../../neat/config';
import { createEpisodeRunConfig } from '../../training/newRun';
import { DEFAULT_DRIVING_BLUEPRINT } from '../blueprints';
import { ADVANCE_SHARE, advanceRule } from '../curriculum';
import { drivingContentHash, initialDrivingContent, nextDrivingContent, type DrivingContent } from './content';
import { DEFAULT_DRIVING_SETTINGS, drivingSettingsOf } from './settings';

const config = createEpisodeRunConfig({ env: 'driving', name: 't', seed: 42, blueprint: DEFAULT_DRIVING_BLUEPRINT, populationSize: 20, settings: { ...DEFAULT_DRIVING_SETTINGS } });

function step(content: DrivingContent, generation: number, env?: Record<string, unknown>, judged = 0, eliteSafe = judged) {
  return nextDrivingContent({ config, content, generation, directives: { plan: defaultPlan(DEFAULT_NEAT), env }, results: [], metrics: { judged, eliteSafe } });
}

describe('driving content', () => {
  it('starts where the run settings say, with the curriculum on', () => {
    const c = initialDrivingContent(config);
    expect(c).toMatchObject({ city: 'midtown', level: 1, trips: DEFAULT_DRIVING_SETTINGS.trips });
    expect(c.curriculum?.level).toBe(1);
  });

  it('moves the trips on every generation, the same way wherever it runs', () => {
    const c = initialDrivingContent(config);
    const a = step(c, 0);
    const b = step(c, 0);
    expect(a.content.tripSeed).not.toBe(c.tripSeed);
    expect(a.content.tripSeed).toBe(b.content.tripSeed);
    expect(a.reset).toBe(false);
    expect(drivingContentHash(a.content)).not.toBe(drivingContentHash(c));
  });

  it('moves up a level once the kept champions arrive safely for a few generations', () => {
    let c = initialDrivingContent(config);
    let reset = false;
    const { window, min } = advanceRule(1);
    for (let g = 0; g < Math.max(window, min); g++) ({ content: c, reset } = step(c, g, undefined, ADVANCE_SHARE));
    expect(c.level).toBe(2);
    expect(reset).toBe(true);
  });

  it('judges the kept champions, not the best fifth picked on the same trips', () => {
    let c = initialDrivingContent(config);
    for (let g = 0; g < 40; g++) c = step(c, g, undefined, 0.2, 0.9).content;
    expect(c.level).toBe(1);
  });

  it('follows the script: a fixed level, more trips, another city, then the curriculum again', () => {
    let c = initialDrivingContent(config);
    c = step(c, 0, { level: 3, trips: 4, city: 'harbor' }).content;
    expect(c).toMatchObject({ level: 3, trips: 4, city: 'harbor', curriculum: null });
    c = step(c, 1, undefined, 1).content;
    expect(c.level).toBe(3);
    c = step(c, 2, { autoLevel: 0.3 }).content;
    expect(c.curriculum?.bar).toBe(0.3);
  });

  it('ignores requests it cannot follow', () => {
    const c = step(initialDrivingContent(config), 0, { city: 'atlantis', level: 'two', trips: Number.NaN }).content;
    expect(c).toMatchObject({ city: 'midtown', level: 1, trips: DEFAULT_DRIVING_SETTINGS.trips });
  });

  it('reads settings loosely and clamps them', () => {
    expect(drivingSettingsOf({ ...config, settings: { city: 'nowhere', level: 9, trips: 0 } })).toEqual({ city: 'midtown', level: 5, auto: true, trips: 1 });
    expect(drivingSettingsOf({ ...config, settings: { city: 'random-12', auto: false } })).toMatchObject({ city: 'random-12', auto: false });
  });
});
