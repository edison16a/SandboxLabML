import { describe, expect, it } from 'vitest';
import { simulationImporters } from './importGraph';

describe('lesson check imports', () => {
  it('keep every env simulation out of the Learn tab until a check runs it', () => {
    // A check loads the env's module when it first runs (loadEpisodeModule), so opening the tab ships no simulation.
    for (const entry of ['evaluate.ts', 'validate.ts', 'catalog.ts', 'preview/record.ts']) {
      expect(simulationImporters(`engine/lessons/${entry}`), entry).toEqual([]);
    }
  });
});
