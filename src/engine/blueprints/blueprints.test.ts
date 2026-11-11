import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '../env/registry';
import { TOY_BLUEPRINT, toyModule } from '../env/tests/toyEnv';
import type { Blueprint } from './types';
import { presetBlueprints, blueprintInputCount, validateBlueprint } from './index';

const expected: Record<string, number> = {
  'racing-tiny': 2,
  'racing-starter': 4,
  'racing-standard': 11,
  'racing-advanced': 15,
  'hideseek-starter': 17,
  'hideseek-standard': 61,
  'hideseek-advanced': 69,
  'driving-starter': 17,
  'driving-standard': 25,
  'driving-advanced': 46,
  'navigation-starter': 11,
  'navigation-standard': 42,
  'navigation-advanced': 53,
};

describe('preset blueprints', () => {
  for (const b of presetBlueprints()) {
    it(`${b.name} has ${expected[b.id]} inputs and validates`, () => {
      expect(blueprintInputCount(b)).toBe(expected[b.id]);
      expect(validateBlueprint(b)).toEqual([]);
      expect(b.readonly).toBe(true);
    });
  }

  it('rejects too many inputs', () => {
    const b = { ...presetBlueprints()[2], id: 'big' };
    expect(validateBlueprint(b, 200).map((i) => i.field)).toContain('inputs');
  });
});

describe('blueprints of a registry env', () => {
  let unregister: () => void;
  beforeAll(() => {
    unregister = registerEpisodeModule(toyModule);
  });
  afterAll(() => unregister());

  it('get the shared noise check, whatever the env checks itself', () => {
    const noisy = (noise: unknown) => ({ ...TOY_BLUEPRINT, inputs: { noise } }) as Blueprint;
    expect(validateBlueprint(noisy(0.05))).toEqual([]);
    expect(validateBlueprint(noisy(0.5)).map((i) => i.field)).toEqual(['noise']);
    expect(validateBlueprint(noisy(-0.01)).map((i) => i.field)).toEqual(['noise']);
    expect(validateBlueprint(noisy(undefined)).map((i) => i.field)).toEqual(['noise']);
  });
});
