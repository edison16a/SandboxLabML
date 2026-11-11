import { describe, expect, it } from 'vitest';
import { DEFAULT_DRIVING_BLUEPRINT } from '@/engine/driving/blueprints';
import { DEFAULT_DRIVING_SETTINGS } from '@/engine/driving/run/settings';
import { MAX_SANDBOX_CARS } from '@/engine/driving/sandbox';
import type { GenerationRecord } from '@/engine/training/records';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { fieldFromGenerations, fieldScene, fieldSize, setCopies } from './field';
import { firstSandbox } from './state';

const run = createEpisodeRunConfig({ env: 'driving', name: 'r', seed: 1, blueprint: DEFAULT_DRIVING_BLUEPRINT, populationSize: 20, settings: { ...DEFAULT_DRIVING_SETTINGS } });
/** Only the fields the field code reads; the genome is never looked inside. */
const records = Array.from({ length: 10 }, (_, g) => ({ generation: g, genome: { id: g }, replaySeed: 100 + g }) as unknown as GenerationRecord);

describe('the Driving Sandbox field', () => {
  it('starts from a spread of champions, newest first', () => {
    expect(fieldFromGenerations([0, 4, 9, 4]).map((e) => e.generation)).toEqual([9, 4, 0]);
    const thinned = fieldFromGenerations(Array.from({ length: 40 }, (_, g) => g));
    expect(thinned).toHaveLength(MAX_SANDBOX_CARS);
    expect(thinned[0].generation).toBe(39);
    expect(thinned[thinned.length - 1].generation).toBe(0);
  });

  it('never lines up more SUVs than the start lane holds', () => {
    let field = fieldFromGenerations([2, 9]);
    field = setCopies(field, 9, 6, 5);
    expect(fieldSize(field)).toBe(5);
    field = setCopies(field, 2, 0, 5);
    expect(field.map((e) => e.generation)).toEqual([9]);
  });

  it('puts the newest champion in front and its first copy ahead of the rest', () => {
    const scene = fieldScene(run, records, setCopies(setCopies(fieldFromGenerations([1, 9]), 9, 3), 1, 2));
    expect(scene.generations).toEqual([1, 1, 9, 9, 9]);
    expect(scene.specs.map((s) => s.slot)).toEqual([3, 4, 0, 1, 2]);
    expect(scene.specs[2].seed).toBe(109);
    expect(fieldScene(run, records, setCopies([], 9, 8), 3).specs).toHaveLength(3);
  });

  it('opens on the trained model when nothing is trained yet', () => {
    expect(firstSandbox(null, []).model).toBe(true);
    const sb = firstSandbox({ city: 'harbor', level: 1, curriculum: null, trips: 3, tripSeed: 7 }, [{ generation: 3, copies: 1 }]);
    expect(sb.model).toBe(false);
    // Empty streets have nothing to show off, so the Sandbox starts with the lights on.
    expect(sb.trip).toEqual({ city: 'harbor', level: 2, seed: 7, destination: null });
  });
});
