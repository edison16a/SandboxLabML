import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDrivingModels } from '@/engine/bench/driving/models';
import { mixSeed } from '@/engine/core/rng';
import { DEFAULT_DRIVING_BLUEPRINT } from '@/engine/driving/blueprints';
import { drivingModule } from '@/engine/driving/module';
import type { DrivingRunResult } from '@/engine/driving/run/results';
import { DEFAULT_DRIVING_SETTINGS } from '@/engine/driving/run/settings';
import { sandboxSetup } from '@/engine/driving/sandbox';
import { Network } from '@/engine/neat/network';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { hostFor } from '@/engine/training/scriptHost';
import { pickModel, trainedModel } from './model';
import { firstSandbox } from './state';

/** Trips the shipped model drives, and the share of them it must arrive on safely. */
const TRIPS = 20;
const SAFE_SHARE = 0.7;

/**
 * "Try a trained model" is the first skilled driving a newcomer sees, so
 * the model a new run picks must actually drive. It drives the Sandbox's
 * own first trip on twenty routes, alone, through the same env and built
 * in rules as the Sandbox replay.
 */
describe('the shipped trained model', () => {
  it('arrives safely on most trips at the level the Sandbox opens on', () => {
    const run = createEpisodeRunConfig({ env: 'driving', name: 'new', seed: 1, blueprint: DEFAULT_DRIVING_BLUEPRINT, populationSize: 100, settings: { ...DEFAULT_DRIVING_SETTINGS } });
    const model = pickModel(parseDrivingModels(JSON.parse(readFileSync('public/references/driving.json', 'utf8'))), run);
    expect(model).not.toBeNull();
    const trained = trainedModel(model!);
    const first = firstSandbox(null, []).trip;
    let safe = 0;
    for (let k = 0; k < TRIPS; k++) {
      const trip = sandboxSetup({ ...first, seed: mixSeed(0x5a, k) }, 1);
      const env = drivingModule.createEnv({ trips: [trip], inputs: trained.model.inputs, scriptSource: null }, hostFor(null), 1);
      env.reset([new Network(trained.genome)], [model!.seed], [0]);
      while (!env.done) env.step();
      safe += (env.results()[0] as DrivingRunResult).safeArrivals;
    }
    expect(safe / TRIPS).toBeGreaterThanOrEqual(SAFE_SHARE);
  }, 120_000);
});
