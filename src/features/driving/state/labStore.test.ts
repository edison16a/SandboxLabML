import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDrivingModels } from '@/engine/bench/driving/models';
import { findPresetBlueprint } from '@/engine/blueprints/presets';
import type { Blueprint } from '@/engine/blueprints/types';
import { DEFAULT_DRIVING_BLUEPRINT } from '@/engine/driving/blueprints';
import { DEFAULT_DRIVING_SETTINGS } from '@/engine/driving/run/settings';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { pickModel, trainedModel } from '../sandbox/model';
import { openedRunState, useDrivingLab } from './labStore';

const SHIPPED = parseDrivingModels(JSON.parse(readFileSync('public/references/driving.json', 'utf8')));
const runOn = (blueprint: Blueprint) => createEpisodeRunConfig({ env: 'driving', name: 'new', seed: 1, blueprint, populationSize: 100, settings: { ...DEFAULT_DRIVING_SETTINGS } });

describe('opening a run', () => {
  const initial = useDrivingLab.getState();
  afterEach(() => useDrivingLab.setState(initial, true));

  it('drops the trained model picked for the run before, and keeps the loaded models', () => {
    const standard = runOn(DEFAULT_DRIVING_BLUEPRINT);
    useDrivingLab.getState().set({ run: standard, trainedModels: SHIPPED, trained: trainedModel(pickModel(SHIPPED, standard)!), trainedLoad: 'ready' });

    const starter = runOn(findPresetBlueprint('driving-starter')!);
    useDrivingLab.getState().set(openedRunState(starter, [], 0));
    const s = useDrivingLab.getState();
    expect(s.trained).toBeNull();
    expect(s.trainedModels).toBe(SHIPPED);
    // So the next Sandbox opening offers the model made for the Starter brain, not the one the Standard run had.
    expect(pickModel(SHIPPED, s.run)?.tier).toBe('beginner');
    expect(pickModel(SHIPPED, standard)?.tier).toBe('intermediate');
  });
});
