import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mixSeed } from '../../core/rng';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { runMatch, startMatch } from '../match/runMatch';
import type { MatchSpec } from '../match/types';
import { HIDESEEK_SNAPSHOT } from '../snapshot';
import { HideSeekTrainer } from '../trainer/trainer';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { CLIMB_RULES, placeRamp } from './climbHelpers';
import { randomGenomes, scripted, scriptedMatch, traceMatch } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const inputs = STANDARD_HIDESEEK_INPUTS;

/** `count` matches between seeded random brains, cycling through the rooms. */
function randomSpecs(count: number, seed: number): MatchSpec[] {
  const hiders = randomGenomes(inputs, count, seed);
  const seekers = randomGenomes(inputs, count, seed + 1);
  return hiders.map((h, i) => ({
    layout: (['open', 'shelter', 'corridor'] as const)[i % 3],
    seed: 500 + i,
    hider: { genome: h, inputs },
    seeker: { genome: seekers[(i * 7) % count], inputs },
  }));
}

describe('determinism', () => {
  it('a match seeded by (run, generation, round, index) replays exactly, even after its world ran other matches', () => {
    const trainer = HideSeekTrainer.create({ seed: 7, hiderInputs: inputs, seekerInputs: inputs, populationSize: 6 });
    const plan = trainer.planGeneration();
    const target = plan[1][3];
    expect(target.seed).toBe(mixSeed(7, 0, 1, 3));

    const first = traceMatch(target, pool);
    const again = traceMatch(target, pool);
    // Run the rest of the generation on the same pool, so the pooled world is reused by other matches.
    for (const round of plan) for (const spec of round) if (spec !== target) runMatch(spec, pool);
    const later = traceMatch(target, pool);

    expect(again.result).toEqual(first.result);
    expect(again.snapshots).toEqual(first.snapshots);
    expect(later.result).toEqual(first.result);
    expect(later.snapshots).toEqual(first.snapshots);
    // Same layouts reuse slots: one per layout, not one per match.
    expect(pool.size).toBe(3);
  });

  it('results do not depend on which matches ran before, whatever the order', async () => {
    const specs = randomSpecs(18, 11);
    const other = await createArenaPool();
    const forward = specs.map((s) => runMatch(s, pool));
    const backward = [...specs].reverse().map((s) => runMatch(s, other)).reverse();
    other.dispose();
    expect(backward).toEqual(forward);
  });

  it('matches with climbing and vaults replay exactly, on a fresh world or a reused one', async () => {
    const stride = HIDESEEK_SNAPSHOT.stride;
    const L = CLIMB_RULES.box.ramp.length;
    // The seeker runs up a ramp by the shelter wall and vaults in; the hider wanders and bumps into things.
    const play = (p: ArenaPool) => {
      const hider = scripted((_, t) => ({ move: 1, turn: Math.sin(t / 25), grab: t % 90 < 45 }));
      const m = scriptedMatch(p, 'shelter', hider, scripted(() => ({ move: 1 })), CLIMB_RULES, 9);
      placeRamp(m, -2.9 + L / 2 + 0.05, -6.5, Math.PI);
      m.moveAgent('seeker', 1.5, -6.5, Math.PI);
      const frames = new Float32Array(300 * stride);
      for (let t = 0; t < 300; t++) {
        m.step();
        m.snapshot(frames, t * stride);
      }
      const out = { frames, result: m.result() };
      m.release();
      return out;
    };
    const first = play(pool);
    expect(first.result.seekerClimbs).toBeGreaterThan(0);
    expect(first.result.seekerVaults).toBe(1);
    // Other matches on the same pool, then again on the reused world, then on a brand new pool.
    for (const spec of randomSpecs(6, 77)) runMatch(spec, pool);
    const reused = play(pool);
    const other = await createArenaPool();
    const fresh = play(other);
    other.dispose();
    expect(reused.result).toEqual(first.result);
    expect(reused.frames).toEqual(first.frames);
    expect(fresh.result).toEqual(first.result);
    expect(fresh.frames).toEqual(first.frames);
  });

  it('a Turbo replay of a round matches the live round stepped tick by tick', async () => {
    const trainer = HideSeekTrainer.create({ seed: 21, hiderInputs: inputs, seekerInputs: inputs, populationSize: 8 });
    const round = trainer.planGeneration()[0];
    const stride = HIDESEEK_SNAPSHOT.stride;

    // Live: every match of the round steps in lockstep, one tick at a time, like the arena grid.
    const live = round.map((spec) => startMatch(spec, pool));
    const grid = new Float32Array(live.length * stride);
    const finalGrid = new Float32Array(live.length * stride);
    while (live.some((m) => !m.done)) {
      live.forEach((m, i) => {
        m.step();
        m.snapshot(grid, i * stride);
      });
    }
    finalGrid.set(grid);
    const liveResults = live.map((m) => m.result());
    live.forEach((m) => m.release());

    // Turbo: each match headless, one after another, on a separate pool.
    const turboPool = await createArenaPool();
    const turbo = round.map((spec) => traceMatch(spec, turboPool));
    turboPool.dispose();

    expect(turbo.map((t) => t.result)).toEqual(liveResults);
    turbo.forEach((t, i) => {
      const last = t.snapshots.subarray(t.snapshots.length - stride);
      expect(Array.from(last)).toEqual(Array.from(finalGrid.subarray(i * stride, (i + 1) * stride)));
    });
  });
});
