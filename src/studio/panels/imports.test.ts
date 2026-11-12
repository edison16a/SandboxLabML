import { describe, expect, it } from 'vitest';
import { rapierImporters } from '@/engine/lessons/tests/importGraph';

describe('Studio panel imports', () => {
  it('keep the Rapier physics engine out of the Test run and Learn tabs and the test worker', () => {
    // Neither lab uses it, so nothing the Studio loads may pull it in.
    for (const entry of ['studio/panels/testrun/TestRunTab.tsx', 'studio/panels/learn/LearnTab.tsx', 'studio/panels/testrun/testRun.worker.ts']) {
      expect(rapierImporters(entry), entry).toEqual([]);
    }
  });
});
