import { describe, expect, it } from 'vitest';
import { findScriptPreset } from '../../script/presets';
import { testDrive } from '../checks/testRun';
import { prepareScript, type PreparedRacing, type PreparedScript } from '../prepare';
import { recordPreview } from '../preview/record';
import type { LessonPreview } from '../preview/types';

const racing = findScriptPreset('racing-beginner')!.source;

function prepared(source: string): PreparedScript {
  const p = prepareScript(source);
  if (!p.ok) throw new Error(p.message);
  return p.value;
}

async function preview(source: string): Promise<LessonPreview> {
  const r = await recordPreview(source);
  if (!r.ok) throw new Error(r.message);
  return r.preview;
}

describe('lesson preview', () => {
  it('records the test drive a check runs, tick by tick', async () => {
    const p = await preview(racing);
    const check = testDrive(prepared(racing) as PreparedRacing);
    if (p.kind !== 'racing') throw new Error('Expected a drive');
    expect(p.ticks).toBe(check.ticks);
    expect(p.poses).toHaveLength(p.ticks * 3);
    expect(p.rays).toHaveLength(p.ticks * p.rayCount * 2);
    expect(p.rewards[p.ticks - 1]).toBeCloseTo(check.totalReward, 3);
    expect(p.center.length).toBe(p.left.length);
    expect(p.width).toBeGreaterThan(0);
    expect(p.poses[0]).toBeGreaterThanOrEqual(p.bounds.minX - p.width);
  });

  it('says why it cannot preview a script', async () => {
    const wrongBrain = await recordPreview(racing.replace(/brain racing-[a-z]+/, 'brain driving-starter'));
    expect(wrongBrain).toMatchObject({ ok: false });
    const broken = await recordPreview('script "x" for racing v1\neach tick {\n  reward car.sped\n}\n');
    expect(!broken.ok && broken.message).toMatch(/Line 3: /);
  });
});
