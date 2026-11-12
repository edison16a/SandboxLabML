import { describe, expect, it } from 'vitest';
import { trainDriving } from './curriculumRun';

/**
 * Generations a default run gets to master empty streets and move on to
 * traffic lights. The curriculum judges the champions on trips they were
 * not picked on, so it waits until they truly drive: seed 1 moves at 76.
 */
const BUDGET = 100;

/**
 * The automatic curriculum must actually move: a default run that never
 * leaves empty streets would never show anyone the lights, the people or
 * the traffic. Each seed trains the lab's default run headless, through
 * the trainer and sim code the workers run, until it reaches level 2.
 */
/** Generations a default run gets before its top level is judged: enough for seed 7 to climb past traffic lights (it does at 130). */
const LONG_BUDGET = 150;

describe('driving curriculum', () => {
  for (const seed of [1, 2]) {
    it(`reaches traffic lights within ${BUDGET} generations (seed ${seed})`, async () => {
      const reached = await trainDriving({ seed, generations: BUDGET, until: 2 });
      expect(reached[1]).toBeDefined();
      expect(reached[1]).toBeLessThanOrEqual(BUDGET);
    }, 600_000);
  }

  it(`still arrives safely at the top level a default run reaches in ${LONG_BUDGET} generations`, async () => {
    const seen: Array<{ level: number; eliteSafe: number }> = [];
    await trainDriving({ seed: 7, generations: LONG_BUDGET, onGeneration: (g) => seen.push({ level: g.level, eliteSafe: g.metrics.eliteSafe ?? 0 }) });
    const top = Math.max(...seen.map((g) => g.level));
    const recent = seen.slice(-10).filter((g) => g.level === top);
    expect(top).toBeGreaterThanOrEqual(3);
    expect(recent.length).toBeGreaterThan(0);
    // A dead end shows here as a top level the best brains never finish a trip on.
    expect(recent.reduce((n, g) => n + g.eliteSafe, 0) / recent.length).toBeGreaterThan(0.05);
  }, 1_500_000);
});
