import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '../../blueprints/presets';
import { mixSeed } from '../../core/rng';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { runMatch } from '../match/runMatch';
import { hideSeekPhysics } from '../physics';
import { HideSeekTrainer } from '../trainer/trainer';
import type { HideSeekTrainerOptions } from '../trainer/types';
import { createArenaPool, type ArenaPool } from '../world/pool';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** Small and quick: 10 per team, 6 second matches. The teams use different input presets on purpose. */
const options = (over: Partial<HideSeekTrainerOptions> = {}): HideSeekTrainerOptions => ({
  seed: 5,
  hiderInputs: STANDARD_HIDESEEK_INPUTS,
  seekerInputs: HIDESEEK_BLUEPRINTS[0].inputs,
  populationSize: 10,
  rounds: 2,
  physics: hideSeekPhysics({ matchSeconds: 6 }),
  ...over,
});

describe('co-evolution trainer', () => {
  it('runs 3 generations end to end with finite fitness and a growing hall of fame', () => {
    const trainer = HideSeekTrainer.create(options());
    for (let g = 0; g < 3; g++) {
      const stats = trainer.runGeneration(pool);
      expect(stats.generation).toBe(g);
      for (const s of [stats.hiders, stats.seekers]) {
        for (const v of [s.best, s.mean, s.median, s.worst]) expect(Number.isFinite(v)).toBe(true);
      }
      expect(stats.game.matches).toBe(20);
      expect(stats.game.hiddenShare).toBeGreaterThanOrEqual(0);
      expect(stats.game.hiddenShare).toBeLessThanOrEqual(1);
      expect(stats.game.hallOfFame).toEqual({ hiders: g + 1, seekers: g + 1 });
    }
    expect(trainer.generation).toBe(3);
    expect(trainer.history).toHaveLength(3);
    expect(trainer.hallOfFame.hiders.size).toBe(3);
  });

  it('plans the v1 rounds: current pairings first, then the hall of fame for both teams', () => {
    const trainer = HideSeekTrainer.create(options({ setup: 'v1', rounds: 4, layouts: ['open', 'corridor'] }));
    trainer.runGeneration(pool);
    const plan = trainer.planGeneration();
    expect(plan.map((r) => r.length)).toEqual([10, 10, 20, 20]);
    expect(plan.map((r) => r[0].layout)).toEqual(['open', 'corridor', 'open', 'corridor']);
    plan.forEach((round, r) => round.forEach((spec, i) => expect(spec.seed).toBe(mixSeed(5, 1, r, i))));
    // Round 1 pairs by index; round 2 shuffles the seekers.
    expect(plan[0].map((s) => s.seeker.slot)).toEqual(plan[0].map((s) => s.hider.slot));
    expect([...plan[1].map((s) => s.seeker.slot)].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // Rounds 3 and 4: every current genome of each team once, against an unscored past champion.
    for (const round of plan.slice(2)) {
      expect(round.slice(0, 10).map((s) => [s.hider.slot, s.seeker.slot])).toEqual(Array.from({ length: 10 }, (_, i) => [i, -1]));
      expect(round.slice(10).map((s) => [s.hider.slot, s.seeker.slot])).toEqual(Array.from({ length: 10 }, (_, i) => [-1, i]));
      const champion = trainer.hallOfFame.seekers.toState()[0].genome.id;
      expect(round.slice(0, 10).every((s) => s.seeker.genome.id === champion)).toBe(true);
    }
    // Every genome plays exactly four scored matches.
    const scored = new Map<number, number>();
    for (const s of plan.flat()) if ((s.hider.slot ?? -1) >= 0) scored.set(s.hider.slot!, (scored.get(s.hider.slot!) ?? 0) + 1);
    expect([...scored.values()]).toEqual(Array(10).fill(4));
  });

  it('resumes from a checkpoint with an identical next generation', () => {
    const a = HideSeekTrainer.create(options({ rounds: 4 }));
    a.runGeneration(pool);
    a.runGeneration(pool);
    const b = HideSeekTrainer.fromState(structuredClone(a.toState()));
    expect(b.generation).toBe(2);
    expect(b.runGeneration(pool)).toEqual(a.runGeneration(pool));
    expect(b.hiders.genomes).toEqual(a.hiders.genomes);
    expect(b.seekers.genomes).toEqual(a.seekers.genomes);
    expect(b.toState()).toEqual(a.toState());
  });

  it('lets a worker pool play the plan in any order', () => {
    const a = HideSeekTrainer.create(options());
    const b = HideSeekTrainer.create(options());
    const planA = a.planGeneration();
    const planB = structuredClone(b.planGeneration());
    // A checkpoint taken mid generation replans the same matches.
    expect(HideSeekTrainer.fromState(a.toState()).planGeneration()).toEqual(planA);
    const results = planA.map((round) => round.map((spec) => runMatch(spec, pool)));
    const shuffled = planB.map((round) => round.map((_, i) => i).reverse().map((i) => ({ i, r: runMatch(round[i], pool) })));
    const reordered = shuffled.map((round) => round.sort((x, y) => x.i - y.i).map((x) => x.r));
    expect(b.completeGeneration(reordered)).toEqual(a.completeGeneration(results));
  });
});
