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
  it('starts from the ghost picks, newest first, and caps the size', () => {
    expect(fieldFromGenerations([0, 4, 9, 4])).toEqual([
      { generation: 9, copies: 1 },
      { generation: 4, copies: 1 },
      { generation: 0, copies: 1 },
    ]);
    expect(fieldFromGenerations(Array.from({ length: 40 }, (_, g) => g))).toHaveLength(MAX_FIELD);
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

  it('expands copies with the newest champion on pole', () => {
    const scene = fieldScene(run, records, setCopies(fieldFromGenerations([1, 9]), 9, 4));
    expect(scene.generations).toEqual([1, 9, 9, 9, 9]);
    expect(scene.specs.map((s) => s.slot)).toEqual([4, 3, 2, 1, 0]);
    expect(scene.specs[4].seed).toBe(109);
  });

  it('skips generations without a stored record', () => {
    expect(fieldScene(run, records, [{ generation: 42, copies: 3 }]).specs).toEqual([]);
  });
});
