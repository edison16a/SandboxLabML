import { describe, expect, it } from 'vitest';
import { scriptEnv } from '@/engine/script/envs';
import { runEpisodeTest } from './run';

describe('the Studio test run of a Navigation script', () => {
  it('runs the starter to the line and labels the numbers the way the lab charts them', async () => {
    const result = await runEpisodeTest(scriptEnv('navigation')!.starter);
    if (!result.ok) throw new Error(result.message);
    expect(result.stopReason).toBe('finished');
    expect(result.metrics.map((m) => m.label)).toEqual(['Progress', 'Finish', 'finished', 'died']);
    expect(result.metrics[0].value).toBe('100%');
    expect(result.metrics[1].value).toMatch(/^\d+\.\d s$/);
    expect(result.blueprint).toBe('Navigation Standard');
  });
});
