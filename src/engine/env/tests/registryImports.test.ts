import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SRC, staticGraph } from '../../lessons/tests/importGraph';

/** Files in the static graph of `entry` that hold an env's simulation: its module, or Racing's env. */
function simulations(entry: string): string[] {
  return [...staticGraph(entry).keys()].map((f) => relative(SRC, f)).filter((f) => /^engine\/[a-z]+\/module\.ts$/.test(f) || f === 'engine/racing/env.ts');
}

describe('the env registry', () => {
  it('keeps every env simulation out of its static graph', () => {
    expect(simulations('engine/env/registry.ts')).toEqual([]);
  });

  it('keeps the simulations off the pages that only list runs or check scripts', () => {
    for (const entry of ['features/runs/RunsPage.tsx', 'storage/exportImport.ts', 'engine/script/checker.ts', 'engine/blueprints/presets.ts']) {
      expect(simulations(entry), entry).toEqual([]);
    }
  });
});
