import { describe, expect, it } from 'vitest';
import { simulationImporters } from '@/engine/lessons/tests/importGraph';

describe('Studio panel imports', () => {
  it('keep every env simulation out of the Test run and Learn tabs and the test worker', () => {
    // Each loads the module of the env it runs on demand, so the Studio page ships none of them.
    for (const entry of ['studio/panels/testrun/TestRunTab.tsx', 'studio/panels/learn/LearnTab.tsx', 'studio/panels/testrun/testRun.worker.ts']) {
      expect(simulationImporters(entry), entry).toEqual([]);
    }
  });
});
