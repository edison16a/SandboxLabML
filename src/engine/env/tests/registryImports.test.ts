import { describe, expect, it } from 'vitest';
import { simulationImporters } from '../../lessons/tests/importGraph';

describe('the env registry', () => {
  it('keeps every env simulation out of its static graph', () => {
    expect(simulationImporters('engine/env/registry.ts')).toEqual([]);
  });

  it('keeps the simulations off the pages that only list runs or check scripts', () => {
    for (const entry of ['features/runs/RunsPage.tsx', 'storage/exportImport.ts', 'engine/script/checker.ts', 'engine/blueprints/presets.ts']) {
      expect(simulationImporters(entry), entry).toEqual([]);
    }
  });
});
