import { describe, expect, it } from 'vitest';
import { simulationImporters } from '@/engine/lessons/tests/importGraph';

describe('worker imports', () => {
  it('boot without any env simulation, which each loads for the run it is handed', () => {
    for (const entry of ['workers/replay/replay.worker.ts', 'workers/sim/sim.worker.ts', 'workers/coordinator/coordinator.worker.ts']) {
      expect(simulationImporters(entry), entry).toEqual([]);
    }
  });
});
