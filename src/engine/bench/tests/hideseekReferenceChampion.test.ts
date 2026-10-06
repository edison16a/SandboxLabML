import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '../../blueprints/presets';
import { HIDESEEK_OUTPUT_COUNT } from '../../hideseek/inputConfig';
import { hideSeekBrainInputs } from '../../hideseek/sensing/inputSchema';
import { createArenaPool, type ArenaPool } from '../../hideseek/world/pool';
import { Population } from '../../neat/population';
import { createHideSeekRunConfig } from '../../training/hideseekRunConfig';
import { opponentsFrom } from '../hideseek/opponents';
import type { ExamOpponent } from '../hideseek/types';
import { runBenchmark } from '../index';
import { readReferences } from '../nodeReferences';
import type { BenchReferences } from '../types';

let pool: ArenaPool;
let refs: BenchReferences | null;
beforeAll(async () => {
  pool = await createArenaPool();
  refs = await readReferences('hideseek');
});
afterAll(() => pool.dispose());

/** A run whose brains sense what the champion's do. Reference presets add no script sensors. */
function runFor(champion: ExamOpponent) {
  const blueprint = HIDESEEK_BLUEPRINTS.find((b) => JSON.stringify(b.inputs) === JSON.stringify(champion.side.hider.inputs));
  if (!blueprint) throw new Error('No preset blueprint senses like this champion.');
  return createHideSeekRunConfig({ name: 'reference', seed: 1, blueprint, populationPerTeam: 50 });
}

describe('a shipped reference champion', () => {
  it('beats a random pair of the same shape and is rated at its shipped rating by the exam', async () => {
    expect(refs).not.toBeNull();
    if (!refs) return;
    const best = [...opponentsFrom(refs)].sort((a, b) => b.rating - a.rating)[0];
    const config = runFor(best);
    const inputs = best.side.hider.inputs;
    const shape = { inputCount: hideSeekBrainInputs(inputs), outputCount: HIDESEEK_OUTPUT_COUNT, activation: 'tanh' as const, wiring: 'direct' as const };
    const [hider, seeker] = Population.create(shape, 99, { populationSize: 2 }).genomes;

    const trained = await runBenchmark(config, { hider: best.side.hider.genome, seeker: best.side.seeker.genome }, { references: refs, pool });
    const random = await runBenchmark(config, { hider, seeker }, { references: refs, pool });
    expect(trained?.score ?? 0).toBeGreaterThan((random?.score ?? 0) + 10);
    expect(trained?.metrics.winRate ?? 0).toBeGreaterThan(random?.metrics.winRate ?? 1);
    // The ratings were fitted from the references' own exams, so the exam gives the same number back.
    expect(Math.abs((trained?.metrics.elo ?? 0) - best.rating)).toBeLessThan(1);
  });
});
