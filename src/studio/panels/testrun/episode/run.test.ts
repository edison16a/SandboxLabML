import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '@/engine/env/registry';
import { toyModule } from '@/engine/env/tests/toyEnv';
import { TOY_SCRIPT_ENV } from '@/engine/env/tests/toyScript';
import { registerScriptEnv } from '@/engine/script/envs';
import { runEpisodeTest } from './run';

let undo: Array<() => void> = [];
beforeAll(() => {
  undo = [registerEpisodeModule(toyModule), registerScriptEnv(TOY_SCRIPT_ENV)];
});
afterAll(() => undo.forEach((f) => f()));

describe('the Studio test run of a registry env', () => {
  it('logs every tick of the lesson test episode and the env metrics', async () => {
    const result = await runEpisodeTest(TOY_SCRIPT_ENV.starter);
    if (!result.ok) throw new Error(result.message);
    expect(result.ticks).toBeGreaterThan(10);
    expect(result.log.time).toHaveLength(result.ticks);
    expect(result.log.total[result.ticks - 1]).toBeCloseTo(result.totalReward, 4);
    expect(result.metrics.map((m) => m.label)).toEqual(['distance']);
    expect(result.metrics[0].value).toMatch(/ m$/);
    expect(result.tickHz).toBe(30);
  });

  it('explains a brain of another env instead of running', async () => {
    const result = await runEpisodeTest(TOY_SCRIPT_ENV.starter.replace('brain toy-basic', 'brain driving-standard'));
    expect(result).toEqual({ ok: false, message: 'Fix this first. Line 2: driving-standard is a driving brain, but this script is for toy.' });
  });
});
