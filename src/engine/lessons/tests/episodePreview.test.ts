import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '../../env/registry';
import { toyModule } from '../../env/tests/toyEnv';
import { TOY_SCRIPT_ENV } from '../../env/tests/toyScript';
import { registerScriptEnv } from '../../script/envs';
import { testEpisode, type PreparedWithBrain } from '../episode/run';
import { prepareScript } from '../prepare';
import { recordPreview } from '../preview/record';
import { previewBuffers } from '../preview/types';

let undo: Array<() => void> = [];
beforeAll(() => {
  undo = [registerEpisodeModule(toyModule), registerScriptEnv(TOY_SCRIPT_ENV)];
});
afterAll(() => undo.forEach((f) => f()));

const STARTER = TOY_SCRIPT_ENV.starter;

describe('the lesson preview of a registry env', () => {
  it('records the test episode a check runs, with the env scene', async () => {
    const r = await recordPreview(STARTER);
    if (!r.ok) throw new Error(r.message);
    const p = r.preview;
    if (p.kind !== 'episode') throw new Error('Expected an episode preview');
    const prepared = prepareScript(STARTER);
    if (!prepared.ok) throw new Error(prepared.message);
    const check = await testEpisode(prepared.value as PreparedWithBrain);
    expect(p.ticks).toBe(check.ticks);
    expect(p.rewards[p.ticks - 1]).toBeCloseTo(check.totalReward, 5);
    expect(p.frames).toHaveLength(p.ticks * p.fields.length);
    expect(p.fields).toEqual(['x', 'stopped']);
    // The world block of every tick, which ends with the tick it was written on.
    expect(p.world).toHaveLength(p.ticks * 2);
    expect(p.world[p.world.length - 1]).toBe(p.ticks);
    expect(p.scene).toEqual({ goal: 10 });
    expect(p.stopReason).toBe('there');
    expect(previewBuffers(p)).toHaveLength(4);
  });

  it('falls back to the env lesson brain when a script names none', async () => {
    const r = await recordPreview(STARTER.replace('brain toy-basic\n', ''));
    expect(r.ok).toBe(true);
  });
});
