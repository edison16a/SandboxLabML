import { describe, expect, it } from 'vitest';
import { rapierImporters } from './importGraph';

describe('lesson check imports', () => {
  it('keep Rapier out of the Learn tab until a Hide and Seek check runs', () => {
    for (const entry of ['evaluate.ts', 'validate.ts', 'catalog.ts', 'preview/record.ts']) {
      expect(rapierImporters(`engine/lessons/${entry}`), entry).toEqual([]);
    }
  });

  it('do load Rapier through the Hide and Seek checks and the match preview', () => {
    for (const entry of ['hideseek/checks.ts', 'preview/match.ts']) {
      expect(rapierImporters(`engine/lessons/${entry}`).length, entry).toBeGreaterThan(0);
    }
  });
});
