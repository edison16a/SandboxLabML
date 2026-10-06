import { describe, expect, it } from 'vitest';
import { HIDESEEK_BEGINNER } from '@/engine/script/presets/hideseekBeginner';
import { runTestMatch } from './episode';
import type { MatchTestOk, MatchTestRequest } from './types';

const ACT = 'act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)';
const script = (tick: string, extra = '') => `script "t" for hideseek v1\nbrain hideseek-standard\neach tick {\n${tick}\n}\n${extra}`;
const PLAYING = script(`  ${ACT}\n  if agent.isHider {\n    reward +1 * dt when agent.hidden\n  } else {\n    reward +1 * dt when agent.seesOpponent\n  }`);

async function play(over: Partial<MatchTestRequest> = {}): Promise<MatchTestOk> {
  const r = await runTestMatch({ source: PLAYING, layout: 'open', brains: 'test', seed: 12, ...over });
  if (!r.ok) throw new Error(r.message);
  return r;
}

describe('Hide and Seek test match', () => {
  it('plays a whole match with the test players and logs both teams every tick', async () => {
    const r = await play();
    expect(r.ticks).toBe(900);
    expect(r.prepTicks).toBe(270);
    expect(r.log.time).toHaveLength(900);
    expect(r.log.hiderTotal[r.ticks - 1]).toBeCloseTo(r.hiderTotal, 4);
    expect(r.log.seekerTotal[r.ticks - 1]).toBeCloseTo(r.seekerTotal, 4);
    // Prep has no hidden or seen time, so neither team scores before it ends.
    expect(r.log.hiderTotal[r.prepTicks - 1]).toBe(0);
    expect(r.hiddenShare + r.seenShare).toBeCloseTo(1, 6);
    expect(r.grabs).toBeGreaterThan(0);
    expect(r.locks).toBeGreaterThan(0);
    expect(r.scriptMicros).toBeGreaterThan(0);
    expect(r.tickMicros).toBeGreaterThan(0);
    const texts = r.log.events.map((e) => e.text);
    expect(r.log.events.find((e) => e.text === 'prep over')?.tick).toBe(r.prepTicks);
    expect(texts).toContain('hider grabbed a cube');
    expect(texts.some((t) => t.startsWith('hider locked a '))).toBe(true);
    expect(r.log.events.at(-1)).toEqual({ tick: 899, text: 'match over' });
  });

  it('is the same match every time, and a new seed or room makes another', async () => {
    const a = await play();
    const b = await play();
    expect(Array.from(b.log.hiderTotal)).toEqual(Array.from(a.log.hiderTotal));
    expect(b.log.events).toEqual(a.log.events);
    const other = await play({ layout: 'shelter' });
    expect(other.layout).toBe('shelter');
    expect(other.log.events).not.toEqual(a.log.events);
  });

  it('plays random brains for the blueprint, the same ones for the same seed', async () => {
    const a = await play({ brains: 'random', seed: 5 });
    const b = await play({ brains: 'random', seed: 5 });
    expect(a.brains).toBe('random');
    expect(a.blueprint).toBe('hideseek-standard');
    expect(Array.from(a.log.seekerTotal)).toEqual(Array.from(b.log.seekerTotal));
  });

  it('keeps the prep time the generation block sets and reports script stops', async () => {
    const r = await play({ source: script(`  ${ACT}\n  stop "tired" when agent.time > 12 s`, 'each generation {\n  prepTime(length: 4 s)\n}\n') });
    expect(r.prepTicks).toBe(120);
    expect(r.log.events.filter((e) => e.text === 'hider stopped: tired' || e.text === 'seeker stopped: tired')).toHaveLength(2);
  });

  it('explains scripts it cannot play instead of throwing', async () => {
    const racingBrain = await runTestMatch({ source: HIDESEEK_BEGINNER.replace('brain hideseek-starter', 'brain racing-starter'), layout: 'open', brains: 'test', seed: 1 });
    expect(racingBrain.ok).toBe(false);
    const broken = await runTestMatch({ source: script('  reward agent.nope'), layout: 'open', brains: 'test', seed: 1 });
    expect(!broken.ok && broken.message).toMatch(/Line 4: /);
  });
});
