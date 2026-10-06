import { describe, expect, it } from 'vitest';
import { RACING_INTERMEDIATE } from '../../script/presets/racingIntermediate';
import { testDrive } from '../checks/testRun';
import { evaluateCheck } from '../evaluate';
import { prepareScript } from '../prepare';
import type { LessonCheck } from '../types';

const script = (tick: string, extra = '') => `script "t" for racing v1
brain racing-starter
each tick {
${tick}
}
${extra}`;

const DRIVING = script('  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +1 when checkpoint.passed\n  stop "crash" when car.offTrack');
const PARKED = script('  drive(steer: 0, pedal: 0)\n  reward +1 when checkpoint.passed\n  stop "stalled" when car.noProgress > 2 s');

function prepared(source: string) {
  const p = prepareScript(source);
  if (!p.ok || p.value.env !== 'racing') throw new Error(p.ok ? 'Not a racing script' : p.message);
  return p.value;
}

describe('compiles checks', () => {
  const check: LessonCheck = { kind: 'compiles', message: 'Make it compile.' };

  it('report the first error with its line', async () => {
    const out = await evaluateCheck(check, script('  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +1 when lap.complete'));
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
    const matches: LessonCheck = { kind: 'compiles', matchesPreset: 'racing-intermediate', message: 'Match Intermediate.' };
    const bare = RACING_INTERMEDIATE.split('\n')
      .filter((l) => !l.trim().startsWith('//') && l.trim() !== '')
      .join('\n');
    expect((await evaluateCheck(matches, bare)).passed).toBe(true);
    const off = await evaluateCheck(matches, RACING_INTERMEDIATE.replace('> 3 s', '> 4 s'));
    expect(off.passed).toBe(false);
    expect(off.message).toContain('car.noProgress > 3 s');
  });
});

describe('astContains checks', () => {
  it('pass when a pattern matches and repeat the step message when not', async () => {
    const check: LessonCheck = { kind: 'astContains', anyOf: [{ stmt: 'stop', uses: ['car.noProgress'] }], message: 'Add a stall rule.' };
    expect((await evaluateCheck(check, PARKED)).passed).toBe(true);
    expect(await evaluateCheck(check, DRIVING)).toEqual({ passed: false, message: 'Add a stall rule.' });
  });
});

describe('test drives', () => {
  it('measure the same numbers every time', () => {
    const a = testDrive(prepared(DRIVING));
    expect(testDrive(prepared(DRIVING))).toEqual(a);
    expect(a.distance).toBeGreaterThan(100);
    expect(a.totalReward).toBe(a.checkpoints);
    expect(a.inputs).toBe(4);
  });

  it("live by the script's own stop rules", () => {
    const parked = testDrive(prepared(PARKED));
    expect(parked.distance).toBeLessThan(1);
    expect(parked.ticks).toBeGreaterThanOrEqual(60);
    expect(parked.ticks).toBeLessThan(70);
    expect(parked.crashed).toBe(0);
  });

  it('compare a metric and report the measured value', async () => {
    const out = await evaluateCheck({ kind: 'testRun', metric: 'ticks', op: '<', value: 100, message: 'Stop it sooner.' }, PARKED);
    expect(out.passed).toBe(true);
    expect(out.measured).toBe(testDrive(prepared(PARKED)).ticks);
  });

  it('name the metrics they know when asked for another', async () => {
    const out = await evaluateCheck({ kind: 'testRun', metric: 'smiles', op: '>', value: 0, message: 'x' }, DRIVING);
    expect(out.passed).toBe(false);
    expect(out.message).toContain('totalReward');
  });
});

describe('training checks', () => {
  const check: LessonCheck = { kind: 'metricAbove', generations: 3, metric: 'bestDistance', value: 50, message: 'Get further.' };

  it('report progress up to 1 and the measured value', async () => {
    const seen: number[] = [];
    const out = await evaluateCheck(check, DRIVING, { onProgress: (f) => seen.push(f) });
    expect(out.passed).toBe(true);
    expect(out.measured).toBeGreaterThan(50);
    expect(seen).toEqual([1 / 3, 2 / 3, 1]);
  });

  it('stop when the signal aborts', async () => {
    const controller = new AbortController();
    const out = await evaluateCheck(check, DRIVING, { signal: controller.signal, onProgress: () => controller.abort() });
    expect(out.passed).toBe(false);
    expect(out.message).toContain('stopped');
  });
});

describe('evaluateCheck', () => {
  it('never throws on a check kind it does not know', async () => {
    const out = await evaluateCheck({ kind: 'mystery', message: 'x' } as unknown as LessonCheck, DRIVING);
    expect(out.passed).toBe(false);
  });
});
