import { describe, expect, it } from 'vitest';
import { trainDriving } from './curriculumRun';

/** Generations a default run gets to master empty streets and move on to traffic lights. */
const BUDGET = 80;

/**
 * The automatic curriculum must actually move: a default run that never
 * leaves empty streets would never show anyone the lights, the people or
 * the traffic. Each seed trains the lab's default run headless, through
 * the trainer and sim code the workers run, until it reaches level 2.
 */
describe('driving curriculum', () => {
  for (const seed of [1, 2]) {
    it(`reaches traffic lights within ${BUDGET} generations (seed ${seed})`, async () => {
      const reached = await trainDriving({ seed, generations: BUDGET, until: 2 });
      expect(reached[1]).toBeDefined();
      expect(reached[1]).toBeLessThanOrEqual(BUDGET);
    }, 600_000);
  }
});
