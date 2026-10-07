import { describe, expect, it } from 'vitest';
import { eagerRapierImporters, rapierImporters } from '@/engine/lessons/tests/importGraph';

describe('replay worker imports', () => {
  it('boot without Rapier, so a replayed car never waits for the physics download', () => {
    // The worker plays Hide and Seek too, so it reaches the loader, but the package itself only loads on first use.
    expect(rapierImporters('workers/replay/replay.worker.ts').length).toBeGreaterThan(0);
    expect(eagerRapierImporters('workers/replay/replay.worker.ts')).toEqual([]);
  });
});
