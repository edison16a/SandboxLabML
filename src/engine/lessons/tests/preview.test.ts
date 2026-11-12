import { describe, expect, it } from 'vitest';
import { findScriptPreset } from '../../script/presets';
import { testEpisode, type PreparedWithBrain } from '../episode/run';
import { prepareScript } from '../prepare';
import { recordPreview } from '../preview/record';
import { previewBuffers } from '../preview/types';

const beginner = findScriptPreset('driving-beginner')!.source;

describe('lesson preview', () => {
  it('records the test drive a check runs, tick by tick', async () => {
    const r = await recordPreview(beginner);
    if (!r.ok) throw new Error(r.message);
    const p = r.preview;
    if (p.kind !== 'episode') throw new Error('Expected an episode preview');
    const prepared = prepareScript(beginner);
    if (!prepared.ok) throw new Error(prepared.message);
    const check = await testEpisode(prepared.value as PreparedWithBrain);
    expect(p.env).toBe('driving');
    expect(p.ticks).toBe(check.ticks);
    expect(p.frames).toHaveLength(p.ticks * p.fields.length);
    expect(p.world).toHaveLength(p.ticks * p.worldFloats);
    expect(p.reach).toHaveLength(p.ticks * p.rays.length);
    expect(p.rewards[p.ticks - 1]).toBeCloseTo(check.totalReward, 3);
    expect(p.scene).not.toBeNull();
    expect(previewBuffers(p)).toHaveLength(4);
  });

  it('says why it cannot preview a script', async () => {
    const wrongBrain = await recordPreview(beginner.replace(/brain driving-[a-z]+/, 'brain navigation-starter'));
    expect(wrongBrain).toMatchObject({ ok: false });
    const broken = await recordPreview('script "x" for driving v1\neach tick {\n  reward car.sped\n}\n');
    expect(!broken.ok && broken.message).toMatch(/Line 3: /);
  });
});
