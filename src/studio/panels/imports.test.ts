import { describe, expect, it } from 'vitest';
import { rapierImporters } from '@/engine/lessons/tests/importGraph';

describe('Studio panel imports', () => {
  it('keep Rapier out of the Test run and Learn tabs and the test worker', () => {
    // Hide and Seek code reaches these only through dynamic imports, so a
    // racing test run or lesson never downloads the physics engine.
    for (const entry of ['studio/panels/testrun/TestRunTab.tsx', 'studio/panels/learn/LearnTab.tsx', 'studio/panels/testrun/testRun.worker.ts']) {
      expect(rapierImporters(entry), entry).toEqual([]);
    }
  });

  it('do load Rapier for a Hide and Seek test match', () => {
    expect(rapierImporters('studio/panels/testrun/hideseek/episode.ts').length).toBeGreaterThan(0);
  });
});
