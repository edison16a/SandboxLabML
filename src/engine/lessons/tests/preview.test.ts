import { describe, expect, it } from 'vitest';
import { HIDESEEK_SNAPSHOT } from '../../hideseek/snapshot';
import { findScriptPreset } from '../../script/presets/racing';
import { HIDESEEK_BEGINNER } from '../../script/presets/hideseekBeginner';
import { testDrive } from '../checks/testRun';
import { playTestMatch } from '../hideseek/testMatch';
import { prepareScript, type PreparedScript } from '../prepare';
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
    const check = testDrive(prepared(racing) as Extract<PreparedScript, { env: 'racing' }>);
    if (p.kind !== 'racing') throw new Error('Expected a drive');
    expect(p.ticks).toBe(check.ticks);
    expect(p.poses).toHaveLength(p.ticks * 3);
    expect(p.rays).toHaveLength(p.ticks * p.rayCount * 2);
    expect(p.rewards[p.ticks - 1]).toBeCloseTo(check.totalReward, 3);
    expect(p.center.length).toBe(p.left.length);
    expect(p.width).toBeGreaterThan(0);
    expect(p.poses[0]).toBeGreaterThanOrEqual(p.bounds.minX - p.width);
  });

  it('records the test match a check plays, one snapshot per tick', async () => {
    const p = await preview(HIDESEEK_BEGINNER);
    const check = await playTestMatch(prepared(HIDESEEK_BEGINNER) as Extract<PreparedScript, { env: 'hideseek' }>);
    if (p.kind !== 'hideseek') throw new Error('Expected a match');
    expect(p.layout).toBe('open');
    expect(p.ticks).toBe(900);
    expect(p.prepTicks).toBe(270);
    expect(p.frames).toHaveLength(900 * HIDESEEK_SNAPSHOT.stride);
    expect(p.rewards[2 * 899]).toBeCloseTo(check!.hiderReward, 3);
    expect(p.rewards[2 * 899 + 1]).toBeCloseTo(check!.seekerReward, 3);
    // The snapshot's clock reads 30 s after the last tick.
    expect(p.frames[899 * HIDESEEK_SNAPSHOT.stride]).toBeCloseTo(30, 3);
  });

  it('says why it cannot preview a script', async () => {
    const wrongBrain = await recordPreview(racing.replace(/brain racing-[a-z]+/, 'brain hideseek-starter'));
    expect(wrongBrain).toMatchObject({ ok: false });
    const broken = await recordPreview('script "x" for racing v1\neach tick {\n  reward car.sped\n}\n');
    expect(!broken.ok && broken.message).toMatch(/Line 3: /);
  });
});
