import { describe, expect, it } from 'vitest';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import type { GenerationRecord } from '@/engine/training/records';
import { createRacingRunConfig } from '@/engine/training/runConfig';
import { fieldFromGenerations, fieldScene, fieldSize, MAX_FIELD, setCopies } from './field';

const run = createRacingRunConfig({ name: 'r', seed: 1, blueprint: RACING_BLUEPRINTS[2], track: BUILT_IN_TRACKS[0], carPreset: 'standard', populationSize: 20 });
/** Only the fields the field code reads; the genome is never looked inside. */
const records = Array.from({ length: 10 }, (_, g) => ({ generation: g, genome: { id: g }, replaySeed: 100 + g }) as unknown as GenerationRecord);

describe('sandbox field', () => {
  it('starts from the ghost picks, newest first, and thins them to fit', () => {
    expect(fieldFromGenerations([0, 4, 9, 4])).toEqual([
      { generation: 9, copies: 1 },
      { generation: 4, copies: 1 },
      { generation: 0, copies: 1 },
    ]);
    const thinned = fieldFromGenerations(Array.from({ length: 40 }, (_, g) => g));
    expect(thinned).toHaveLength(MAX_FIELD);
    expect(thinned[0].generation).toBe(39);
    expect(thinned[thinned.length - 1].generation).toBe(0);
    expect(fieldFromGenerations([0, 10, 20, 30, 40], 3).map((e) => e.generation)).toEqual([40, 20, 0]);
  });

  it('adds, removes and clamps copies', () => {
    let field = fieldFromGenerations([2, 9]);
    field = setCopies(field, 9, 6);
    expect(fieldSize(field)).toBe(7);
    field = setCopies(field, 5, 100);
    expect(fieldSize(field)).toBe(MAX_FIELD);
    expect(field.map((e) => e.generation)).toEqual([9, 5, 2]);
    field = setCopies(field, 2, 0);
    expect(field.map((e) => e.generation)).toEqual([9, 5]);
  });

  it('expands copies with the newest champion on pole and its first copy at the front', () => {
    const scene = fieldScene(run, records, setCopies(setCopies(fieldFromGenerations([1, 9]), 9, 4), 1, 2));
    expect(scene.generations).toEqual([1, 1, 9, 9, 9, 9]);
    expect(scene.specs.map((s) => s.slot)).toEqual([4, 5, 0, 1, 2, 3]);
    expect(scene.specs[2].seed).toBe(109);
  });

  it('skips generations without a stored record', () => {
    expect(fieldScene(run, records, [{ generation: 42, copies: 3 }]).specs).toEqual([]);
  });
});
