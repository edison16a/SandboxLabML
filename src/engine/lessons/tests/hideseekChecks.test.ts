import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../evaluate';
import { playTestMatch } from '../hideseek/testMatch';
import { prepareScript } from '../prepare';
import type { LessonCheck } from '../types';

const ACT = 'act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)';
const V1 = `  if agent.isHider {
    reward +1 * dt when agent.hidden
    reward -1 * dt when agent.seen
  } else {
    reward +1 * dt when agent.seesOpponent
    reward -1 * dt when not agent.prep and not agent.seesOpponent
  }`;

const script = (tick: string, extra = '', brain = 'hideseek-standard') => `script "t" for hideseek v1
brain ${brain}
each tick {
${tick}
}
${extra}`;

const PLAYING = script(`  ${ACT}\n${V1}`);
const STILL = script(`  act(move: 0, turn: 0, grab: 0, lock: 0)\n${V1}`);

function prepared(source: string) {
  const p = prepareScript(source);
  if (!p.ok || p.value.env !== 'hideseek') throw new Error(p.ok ? 'Not a Hide and Seek script' : p.message);
  return p.value;
}

describe('Hide and Seek test matches', () => {
  it('measure the same numbers every time', async () => {
    const a = await playTestMatch(prepared(PLAYING));
    expect(await playTestMatch(prepared(PLAYING))).toEqual(a);
    expect(a?.inputs).toBe(55);
    expect(a?.hiderDistance).toBeGreaterThan(5);
    expect(a?.seekerDistance).toBeGreaterThan(5);
    expect(a?.grabs).toBeGreaterThan(0);
    expect(a?.locks).toBeGreaterThan(0);
  });

  it("follow the script's act line and score with its rewards", async () => {
    const m = await playTestMatch(prepared(STILL));
    expect(m?.hiderDistance).toBeLessThan(0.5);
    expect(m?.grabs).toBe(0);
    // The v1 rewards are zero sum, so the two teams' points cancel exactly.
    expect(m?.rewardSum).toBe(0);
    expect(m!.hiderReward).toBeCloseTo((m!.hiddenShare - m!.seenShare) * 21, 6);
  });

  it('play in the first room the generation block asks for, with its prep time', () => {
    const p = prepared(script(`  ${ACT}`, 'each generation {\n  useLayout(id: "corridor")\n  useLayout(id: "open")\n  prepTime(length: 4 s)\n}\n'));
    expect(p.rules).toEqual({ layout: 'corridor', prepSeconds: 4 });
    expect(prepared(PLAYING).rules).toEqual({ layout: 'open' });
  });

  it('name the metrics they know when asked for another', async () => {
    const out = await evaluateCheck({ kind: 'testRun', metric: 'distance', op: '>', value: 0, message: 'x' }, PLAYING);
    expect(out.passed).toBe(false);
    expect(out.message).toContain('hiderDistance');
  });
});

describe('Hide and Seek training checks', () => {
  const generationBlock = 'each generation {\n  opponents(current: 1, hallOfFame: 1)\n}\n';
  const check: LessonCheck = { kind: 'metricAbove', generations: 2, metric: 'hallOfFameMatches', value: 0, message: 'Play past champions.' };

  it('train with the generation block and report progress up to 1', async () => {
    const seen: number[] = [];
    const out = await evaluateCheck(check, script(`  ${ACT}\n${V1}`, generationBlock, 'hideseek-starter'), { onProgress: (f) => seen.push(f) });
    expect(out.passed, out.message).toBe(true);
    // One hall of fame round: each of the 4 hiders and 4 seekers meets a past champion once.
    expect(out.measured).toBe(8);
    expect(seen[seen.length - 1]).toBe(1);
    expect(seen.every((f, i) => i === 0 || f > seen[i - 1])).toBe(true);
  });

  it('stop when the signal aborts', async () => {
    const controller = new AbortController();
    const source = script(`  ${ACT}\n${V1}`, generationBlock, 'hideseek-starter');
    const out = await evaluateCheck(check, source, { signal: controller.signal, onProgress: () => controller.abort() });
    expect(out.passed).toBe(false);
    expect(out.message).toContain('stopped');
  });

  it('name the metrics they know when asked for another', async () => {
    const out = await evaluateCheck({ ...check, metric: 'bestDistance' }, PLAYING);
    expect(out.message).toContain('currentHiddenShare');
  });
});
