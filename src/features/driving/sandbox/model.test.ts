import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDrivingModels } from '@/engine/bench/driving/models';
import { mixSeed } from '@/engine/core/rng';
import { DEFAULT_DRIVING_BLUEPRINT } from '@/engine/driving/blueprints';
import { drivingModule } from '@/engine/driving/module';
import type { DrivingRunResult } from '@/engine/driving/run/results';
import { DEFAULT_DRIVING_SETTINGS } from '@/engine/driving/run/settings';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { rehearseScene } from '@/workers/replay/ghostEnvs';
import { checkedTrip, modelSetup, sandboxScene, type Rehearse } from './firstTrip';
import { pickModel, trainedModel } from './model';
import { firstSandbox, STARTING_MODEL_COPIES } from './state';

/** Trips the shipped model drives, and the share of its SUVs that must arrive safely. */
const TRIPS = 20;
const SAFE_SHARE = 0.7;

/** The model a new default run picks, ready to drive. */
function shippedModel() {
  const run = createEpisodeRunConfig({ env: 'driving', name: 'new', seed: 1, blueprint: DEFAULT_DRIVING_BLUEPRINT, populationSize: 100, settings: { ...DEFAULT_DRIVING_SETTINGS } });
  const model = pickModel(parseDrivingModels(JSON.parse(readFileSync('public/references/driving.json', 'utf8'))), run);
  expect(model).not.toBeNull();
  return trainedModel(model!);
}

/** The replay worker's rehearsal, run in place. */
const rehearse: Rehearse = async (setup, specs) => rehearseScene(drivingModule, setup, specs);

/**
 * "Try a trained model" is the first skilled driving a newcomer sees, so
 * the model a new run picks must actually drive. These tests drive the
 * same lineup the Sandbox opens with (three copies on slots 0 to 2),
 * through the same env, built in rules and ghost envs as the replay.
 */
describe('the shipped trained model', () => {
  const trained = shippedModel();
  const first = firstSandbox(null, []);

  it('opens on the trained model and checks its first trip', () => {
    expect(first.model).toBe(true);
    expect(first.checkTrip).toBe(true);
    expect(first.modelCopies).toBe(STARTING_MODEL_COPIES);
  });

  it('arrives safely with most of its SUVs on trips at the level the Sandbox opens on', async () => {
    let safe = 0;
    let suvs = 0;
    for (let k = 0; k < TRIPS; k++) {
      const { setup, specs } = modelSetup({ ...first.trip, seed: mixSeed(0x5a, k) }, trained, STARTING_MODEL_COPIES);
      const results = (await rehearse(setup, specs)) as DrivingRunResult[];
      suvs += results.length;
      safe += results.reduce((n, r) => n + r.safeArrivals, 0);
    }
    expect(suvs).toBe(TRIPS * STARTING_MODEL_COPIES);
    expect(safe / suvs).toBeGreaterThanOrEqual(SAFE_SHARE);
  }, 120_000);

  it('moves a first trip it would fail onto one every copy arrives on safely', async () => {
    for (let k = 0; k < 8; k++) {
      const trip = await checkedTrip({ ...first.trip, seed: mixSeed(0x5c, k) }, trained, STARTING_MODEL_COPIES, rehearse);
      // Drive the scene the Sandbox plays, not a copy of the rehearsed lineup.
      const { setup, specs } = sandboxScene({ ...first, trip, checkTrip: false }, trained.run, [], trained, {});
      const results = (await rehearse(setup, specs)) as DrivingRunResult[];
      expect(results.every((r) => r.safeArrivals === 1)).toBe(true);
    }
  }, 120_000);

  it('keeps the trip when no route works', async () => {
    const trip = { ...first.trip, seed: 9 };
    const failing: Rehearse = async (_setup, specs) => specs.map(() => ({ trips: 1, safeArrivals: 0 }));
    expect(await checkedTrip(trip, trained, STARTING_MODEL_COPIES, failing)).toEqual(trip);
  });
});
