import { describe, expect, it } from 'vitest';
import type { ReferenceModel } from '@/engine/bench/types';
import { NAVIGATION_BLUEPRINTS } from '@/engine/navigation/pipeline/blueprints';
import { navigationSettings } from '@/engine/navigation/pipeline/settings';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { SANDBOX_DEFAULTS, type NavSandbox } from '../state/sandboxState';
import { carryLesions, sandboxInputKeys } from './sandboxLesions';

const run = createEpisodeRunConfig({ env: 'navigation', name: 't', seed: 3, blueprint: NAVIGATION_BLUEPRINTS[1], populationSize: 20, settings: { ...navigationSettings() } });
const model = { tier: 'advanced', seed: 1, generation: 9, score: 80, blueprint: 'navigation-starter', preset: 'navigation-advanced', genome: '' } as ReferenceModel;
const onRun: NavSandbox = { ...SANDBOX_DEFAULTS, source: 'run' };
const onModel: NavSandbox = { ...SANDBOX_DEFAULTS, source: 'model', model: 'advanced', models: [model] };

describe('Sandbox lesions across brains', () => {
  it('lists the inputs of the brain on screen', () => {
    expect(sandboxInputKeys(run, onRun, 0)).toHaveLength(42);
    expect(sandboxInputKeys(run, onModel, 0)).toHaveLength(11);
  });

  it('keeps a lesion on an input both brains read, at its new index, and drops one the new brain lacks', () => {
    const fromModel = sandboxInputKeys(run, onModel, 0);
    const toRun = sandboxInputKeys(run, onRun, 0);
    const hint = fromModel.indexOf('pathHint');
    const ahead = fromModel.indexOf('ray:0');
    // The Starter model's 45 degree rays are not among the Standard brain's 30 degree ones.
    const side = fromModel.indexOf('ray:45');
    expect(side).toBeGreaterThanOrEqual(0);
    const carried = carryLesions({ [hint]: 0, [ahead]: 0, [side]: 0 }, fromModel, toRun);
    expect(carried).toEqual({ [toRun.indexOf('pathHint')]: 0, [toRun.indexOf('ray:0')]: 0 });
  });
});
