import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '../../blueprints/presets';
import { mixSeed } from '../../core/rng';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { runMatch, startMatch } from '../match/runMatch';
import { hideSeekPhysics } from '../physics';
import { HideSeekTrainer } from '../trainer/trainer';
import type { HideSeekTrainerOptions, HideSeekTrainerState } from '../trainer/types';
import { createArenaPool, type ArenaPool } from '../world/pool';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const options = (over: Partial<HideSeekTrainerOptions> = {}): HideSeekTrainerOptions => ({
  seed: 9,
  hiderInputs: STANDARD_HIDESEEK_INPUTS,
  seekerInputs: HIDESEEK_BLUEPRINTS[0].inputs,
  populationSize: 6,
  physics: hideSeekPhysics({ matchSeconds: 4 }),
  ...over,
});

describe('training setups', () => {
  it('new runs default to v2: cover rewards, a scripted round and mixed rooms', () => {
    const o = HideSeekTrainer.create(options()).options;
    expect([o.setup, o.reward, o.mixLayouts, o.sharedSeeds]).toEqual(['v2', 'cover', true, false]);
    expect(o.opponents).toEqual({ current: 2, hallOfFame: 1, scripted: 1 });
    expect(o.rounds).toBe(4);
  });

  it('v1 keeps the original schedule, and the rounds option still works', () => {
    const o = HideSeekTrainer.create(options({ setup: 'v1', rounds: 3 })).options;
    expect([o.reward, o.mixLayouts, o.opponents]).toEqual(['v1', false, { current: 2, hallOfFame: 1, scripted: 0 }]);
    expect(HideSeekTrainer.create(options({ rounds: 3 })).options.opponents).toEqual({ current: 2, hallOfFame: 0, scripted: 1 });
    expect(() => HideSeekTrainer.create(options({ opponents: { current: 0, hallOfFame: 0, scripted: 0 } }))).toThrow();
  });

  it('a scripted round pits every current genome against a scripted opponent, scored on its side only', () => {
    const plan = HideSeekTrainer.create(options()).planGeneration();
    expect(plan.map((r) => r.length)).toEqual([6, 6, 12, 12]);
    const sparring = plan[3];
    expect(sparring.slice(0, 6).map((s) => [s.hider.slot, s.seeker.slot, s.seeker.scripted])).toEqual(Array.from({ length: 6 }, (_, i) => [i, -1, true]));
    expect(sparring.slice(6).map((s) => [s.hider.slot, s.hider.scripted, s.seeker.slot])).toEqual(Array.from({ length: 6 }, (_, j) => [-1, true, j]));
  });

  it('mixed rooms give every hider each room once in the mixed rounds, and the same leftover room', () => {
    const plan = HideSeekTrainer.create(options()).planGeneration();
    expect(new Set(plan[0].map((s) => s.layout)).size).toBe(1);
    // Hider i sits at index i in every round.
    for (let i = 0; i < 6; i++) expect(new Set(plan.slice(1).map((round) => round[i].layout)).size, `hider ${i}`).toBe(3);
  });

  it('shared seeds give every match of a round the same seed', () => {
    const plan = HideSeekTrainer.create(options({ sharedSeeds: true })).planGeneration();
    plan.forEach((round, r) => round.forEach((spec) => expect(spec.seed).toBe(mixSeed(9, 0, r))));
  });

  it('records the sparring shares in the generation stats', () => {
    const stats = HideSeekTrainer.create(options()).runGeneration(pool);
    for (const v of [stats.game.scriptedHiddenShare, stats.game.scriptedSeenShare, stats.game.exposedShare]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('a checkpoint from before setups existed resumes as v1', () => {
    const state = HideSeekTrainer.create(options({ setup: 'v1' })).toState();
    const old = structuredClone(state) as HideSeekTrainerState;
    const stored = old.options as Partial<HideSeekTrainerState['options']>;
    for (const key of ['setup', 'opponents', 'mixLayouts', 'sharedSeeds'] as const) delete stored[key];
    const resumed = HideSeekTrainer.fromState(old);
    expect(resumed.options).toEqual(state.options);
    expect(resumed.planGeneration()).toEqual(HideSeekTrainer.fromState(state).planGeneration());
  });
});

describe('directives', () => {
  it('change prep time, rooms, opponents and hall of fame size from the next plan on', () => {
    const t = HideSeekTrainer.create(options());
    const pending = t.planGeneration();
    t.applyDirective({ prepSeconds: 1.5, layouts: ['corridor'], opponents: { current: 1, hallOfFame: 0, scripted: 1 }, hallOfFameSize: 3 });
    expect(t.planGeneration()).toBe(pending);
    t.completeGeneration(pending.map((round) => round.map((spec) => runMatch(spec, pool))));
    const plan = t.planGeneration();
    expect(plan.map((r) => r.length)).toEqual([6, 12]);
    expect(plan.flat().every((s) => s.layout === 'corridor' && s.prepSeconds === 1.5)).toBe(true);
    expect(t.hallOfFame.hiders.capacity).toBe(3);
    const match = startMatch(plan[0][0], pool);
    expect(match.state.prepTicks).toBe(45);
    match.release();
  });

  it('ignore values that cannot be played', () => {
    const t = HideSeekTrainer.create(options());
    const before = structuredClone(t.options);
    t.applyDirective({ opponents: { current: 0, hallOfFame: 0, scripted: 0 } });
    t.applyDirective({ layouts: ['moon' as 'open'], prepSeconds: Number.NaN });
    expect(t.options).toEqual(before);
    t.applyDirective({ prepSeconds: 99 });
    expect(t.options.prepSeconds).toBe(20);
  });

  it('switch room mixing and shared starts', () => {
    const t = HideSeekTrainer.create(options());
    t.applyDirective({ mixLayouts: false, sharedSeeds: true });
    expect([t.options.mixLayouts, t.options.sharedSeeds]).toEqual([false, true]);
    const plan = t.planGeneration();
    for (const round of plan) expect(new Set(round.map((s) => `${s.layout} ${s.seed}`)).size).toBe(1);
  });
});
