import { describe, expect, it } from 'vitest';
import { PRESET_BLUEPRINTS, blueprintInputCount, validateBlueprint } from './index';

const expected: Record<string, number> = {
  'racing-tiny': 2,
  'racing-starter': 4,
  'racing-standard': 11,
  'racing-advanced': 15,
  'hideseek-starter': 17,
  'hideseek-standard': 61,
  'hideseek-advanced': 69,
};

describe('preset blueprints', () => {
  for (const b of PRESET_BLUEPRINTS) {
    it(`${b.name} has ${expected[b.id]} inputs and validates`, () => {
      expect(blueprintInputCount(b)).toBe(expected[b.id]);
      expect(validateBlueprint(b)).toEqual([]);
      expect(b.readonly).toBe(true);
    });
  }

  it('rejects too many inputs', () => {
    const b = { ...PRESET_BLUEPRINTS[2], id: 'big' };
    expect(validateBlueprint(b, 200).map((i) => i.field)).toContain('inputs');
  });
});
