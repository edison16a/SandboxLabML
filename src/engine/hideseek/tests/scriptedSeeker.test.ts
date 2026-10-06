import { describe, expect, it } from 'vitest';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { runMatch } from '../match/runMatch';
import type { MatchSpec } from '../match/types';
import { scriptedSeekerController } from '../scriptedSeeker';
import { createArenaPool } from '../world/pool';
import { randomGenomes } from './helpers';

describe('scripted seeker', () => {
  it('finds random hiders far more often than random seekers do', async () => {
    const pool = await createArenaPool();
    const inputs = STANDARD_HIDESEEK_INPUTS;
    const hiders = randomGenomes(inputs, 24, 61);
    const seekers = randomGenomes(inputs, 24, 62);
    const specs: MatchSpec[] = hiders.map((h, i) => ({
      layout: (['open', 'shelter', 'corridor'] as const)[i % 3],
      seed: 900 + i,
      hider: { genome: h, inputs },
      seeker: { genome: seekers[i], inputs },
    }));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const vsRandom = mean(specs.map((s) => runMatch(s, pool).hiddenShare));
    const vsScripted = mean(specs.map((s) => runMatch(s, pool, { seeker: scriptedSeekerController }).hiddenShare));
    console.log(`random hiders stay hidden ${vsRandom.toFixed(2)} of the time against random seekers, ${vsScripted.toFixed(2)} against the scripted seeker`);
    expect(vsScripted).toBeLessThan(vsRandom - 0.2);
    pool.dispose();
  });
});
