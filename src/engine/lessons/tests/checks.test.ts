import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '../../env/registry';
import { toyModule } from '../../env/tests/toyEnv';
import { TOY_SCRIPT_ENV } from '../../env/tests/toyScript';
import { registerScriptEnv } from '../../script/envs';
import { DRIVING_INTERMEDIATE } from '../../script/presets/drivingIntermediate';
import { evaluateCheck } from '../evaluate';
import type { LessonCheck } from '../types';

const script = (tick: string, extra = '') => `script "t" for driving v1
brain driving-starter
each tick {
${tick}
}
${extra}`;

const MOVING = script('  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +0.02 * route.gain\n  stop "crash" when car.offRoad');
const PARKED = script('  drive(steer: 0, pedal: 0)\n  reward +0.02 * route.gain\n  stop "stuck" when car.noProgress > 2 s');

describe('compiles checks', () => {
  const check: LessonCheck = { kind: 'compiles', message: 'Make it compile.' };

  it('report the first error with its line', async () => {
    const out = await evaluateCheck(check, script('  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +10 when car.arrive'));
    expect(out.passed).toBe(false);
    expect(out.message).toMatch(/^Fix this first\. Line 5:/);
  });

  it('can insist on no warnings', async () => {
    const noReward = script('  drive(steer: brain.steer, pedal: brain.pedal)');
    expect((await evaluateCheck(check, noReward)).passed).toBe(true);
    const strict = await evaluateCheck({ ...check, noWarnings: true }, noReward);
    expect(strict.passed).toBe(false);
    expect(strict.message).toContain('Line 3:');
  });

  it('match a preset while ignoring comments and blank lines', async () => {
    const matches: LessonCheck = { kind: 'compiles', matchesPreset: 'driving-intermediate', message: 'Match Intermediate.' };
    const bare = DRIVING_INTERMEDIATE.split('\n')
      .filter((l) => !l.trim().startsWith('//') && l.trim() !== '')
      .join('\n');
    expect((await evaluateCheck(matches, bare)).passed).toBe(true);
    const off = await evaluateCheck(matches, DRIVING_INTERMEDIATE.replace('> 8 s', '> 9 s'));
    expect(off.passed).toBe(false);
    expect(off.message).toContain('car.noProgress > 8 s');
  });
});

describe('astContains checks', () => {
  it('pass when a pattern matches and repeat the step message when not', async () => {
    const check: LessonCheck = { kind: 'astContains', anyOf: [{ stmt: 'stop', uses: ['car.noProgress'] }], message: 'Add a stuck rule.' };
    expect((await evaluateCheck(check, PARKED)).passed).toBe(true);
    expect(await evaluateCheck(check, MOVING)).toEqual({ passed: false, message: 'Add a stuck rule.' });
  });
});

describe('test drives', () => {
  const ticks: LessonCheck = { kind: 'testRun', metric: 'ticks', op: '<', value: 100, message: 'Stop it sooner.' };

  it('measure the same numbers every time', async () => {
    const check: LessonCheck = { kind: 'testRun', metric: 'distance', op: '>', value: 1, message: 'Drive.' };
    const a = await evaluateCheck(check, MOVING);
    expect(a.passed).toBe(true);
    expect((await evaluateCheck(check, MOVING)).measured).toBe(a.measured);
  });

  it("live by the script's own stop rules, and report the measured value", async () => {
    const out = await evaluateCheck(ticks, PARKED);
    expect(out.passed).toBe(true);
    expect(out.measured).toBeGreaterThanOrEqual(60);
    expect(out.message).toMatch(/^Passed\. Test drive: /);
  });

  it('name the metrics they know when asked for another', async () => {
    const out = await evaluateCheck({ kind: 'testRun', metric: 'smiles', op: '>', value: 0, message: 'x' }, MOVING);
    expect(out.passed).toBe(false);
    expect(out.message).toContain('totalReward');
  });
});

describe('training checks', () => {
  let undo: Array<() => void> = [];
  beforeAll(() => {
    undo = [registerEpisodeModule(toyModule), registerScriptEnv(TOY_SCRIPT_ENV)];
  });
  afterAll(() => undo.forEach((f) => f()));

  // The toy env trains in a blink, so these check how training checks behave, not what a lab learns.
  const check: LessonCheck = { kind: 'metricAbove', generations: 3, metric: 'bestFitness', value: 0, message: 'Walk further.' };

  it('report progress up to 1 and the measured value', async () => {
    const seen: number[] = [];
    const out = await evaluateCheck(check, TOY_SCRIPT_ENV.starter, { onProgress: (f) => seen.push(f) });
    expect(out.passed).toBe(true);
    expect(out.measured).toBeGreaterThan(0);
    expect(seen).toEqual([1 / 3, 2 / 3, 1]);
  });

  it('stop when the signal aborts', async () => {
    const controller = new AbortController();
    const out = await evaluateCheck(check, TOY_SCRIPT_ENV.starter, { signal: controller.signal, onProgress: () => controller.abort() });
    expect(out.passed).toBe(false);
    expect(out.message).toContain('stopped');
  });

  it('name the metrics they know when asked for another', async () => {
    const out = await evaluateCheck({ ...check, metric: 'smiles' }, TOY_SCRIPT_ENV.starter);
    expect(out.passed).toBe(false);
    expect(out.message).toContain('reachedShare');
  });
});

describe('evaluateCheck', () => {
  it('never throws on a check kind it does not know', async () => {
    const out = await evaluateCheck({ kind: 'mystery', message: 'x' } as unknown as LessonCheck, MOVING);
    expect(out.passed).toBe(false);
  });

  it('says so when a script is for a lab this version does not have', async () => {
    const out = await evaluateCheck({ kind: 'compiles', message: 'x' }, 'script "t" for hideseek v1\neach tick {\n}\n');
    expect(out.passed).toBe(false);
    expect(out.message).toMatch(/^Fix this first\. Line 1: There is no environment called hideseek\./);
  });
});
