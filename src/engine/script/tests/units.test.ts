import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '../../env/registry';
import { toyModule } from '../../env/tests/toyEnv';
import { TOY_SCRIPT_ENV } from '../../env/tests/toyScript';
import { registerScriptEnv } from '../envs';
import { applyEdits } from '../diagnostics';
import { parse } from '../parser';
import { check } from '../checker';
import { dimWords, formatDim, mulDim, sqrtDim, toBase } from '../units';
import { DRIVE, errors, inTick } from './helpers';

const body = (line: string) => inTick(`  ${DRIVE}\n  ${line}`);
const codes = (line: string) => errors(body(line)).map((d) => d.code);

/** The constant value the checker worked out for the `when` of the first reward. */
function rewardWhenValue(line: string): number | boolean | undefined {
  const program = parse(body(line)).program;
  const result = check(program);
  const each = program.items.find((i) => i.kind === 'each');
  const reward = each?.kind === 'each' ? each.body.stmts.find((s) => s.kind === 'reward') : undefined;
  return reward?.kind === 'reward' ? result.exprs.get(reward.value)?.value : undefined;
}

describe('unit checks', () => {
  it('meters plus seconds is an error with a fix', () => {
    const source = body('reward route.remaining + 5 s');
    const [d] = errors(source);
    expect(d.message).toBe('Adding meters to seconds. Did you mean 5 m?');
    expect(errors(applyEdits(source, d.fixes![0].edits))).toEqual([]);
  });

  it('a plain number compared with seconds gets a fix that adds s', () => {
    const source = body('stop "stalled" when car.noProgress > 5');
    const [d] = errors(source);
    expect(d.message).toBe('Comparing seconds to a plain number. Did you mean 5 s?');
    expect(applyEdits(source, d.fixes![0].edits)).toBe(body('stop "stalled" when car.noProgress > 5 s'));
  });

  it('5 s against car.noProgress is fine', () => {
    expect(codes('stop "stalled" when car.noProgress > 5 s')).toEqual([]);
  });

  it('multiplying and dividing combine units', () => {
    expect(codes('reward 1 when route.remaining / car.time > 3 m/s')).toEqual([]);
    expect(codes('reward 1 when car.speed * car.time > 10 m')).toEqual([]);
    expect(codes('reward 1 when car.speed / car.time > 2 m/s2')).toEqual([]);
    expect(codes('reward 1 when car.speed * car.time > 10 s')).toEqual(['unit-mismatch']);
  });

  it('a bare zero fits any unit', () => {
    expect(codes('reward 1 when car.speed > 0')).toEqual([]);
    expect(codes('reward 1 when car.speed > 1')).toEqual(['unit-mismatch']);
  });

  it('function arguments must share a unit', () => {
    expect(codes('reward min(car.speed, 3 m/s)')).toEqual([]);
    expect(codes('reward min(car.speed, 3 s)')).toEqual(['unit-mismatch']);
  });

  it('square roots halve units and refuse odd ones', () => {
    expect(codes('reward 1 when sqrt(route.remaining * route.remaining) > 1 m')).toEqual([]);
    expect(codes('reward 1 when sqrt(route.remaining) > 1')).toEqual(['bad-unit']);
  });

  it('rewards accept any unit', () => {
    expect(codes('reward 0.01 * car.speed')).toEqual([]);
    expect(codes('reward car.time')).toEqual([]);
  });

  it('degrees and percent convert at compile time', () => {
    expect(rewardWhenValue('reward 30 deg')).toBeCloseTo(Math.PI / 6, 15);
    expect(rewardWhenValue('reward 20%')).toBeCloseTo(0.2, 15);
    expect(rewardWhenValue('reward 2 m/s² * 3 s')).toBe(6);
    expect(codes('reward 1 when lane.headingError > 30 deg')).toEqual([]);
    expect(codes('reward 1 when 1 / route.remaining > 0.05 1/m')).toEqual([]);
  });

  describe('a parameter with a unit of its own', () => {
    let undo: Array<() => void> = [];
    beforeAll(() => {
      undo = [registerEpisodeModule(toyModule), registerScriptEnv(TOY_SCRIPT_ENV)];
    });
    afterAll(() => undo.forEach((f) => f()));

    const toy = (line: string) => errors(`script "t" for toy v1\nbrain toy-basic\n\neach tick {\n  walk(move: brain.move)\n  ${line}\n}\n`).map((d) => d.code);

    it('takes an argument in that unit, and refuses a plain number or another unit', () => {
      expect(toy('reward 1 when toy.ahead(distance: 2 m) > walker.goal')).toEqual([]);
      expect(toy('reward 1 when toy.ahead(distance: 2) > walker.goal')).toEqual(['unit-mismatch']);
      expect(toy('reward 1 when toy.ahead(distance: 2 s) > walker.goal')).toEqual(['unit-mismatch']);
    });
  });

  it('describes units in words', () => {
    expect(dimWords([1, -1, 0])).toBe('meters per second');
    expect(dimWords([0, 0, 0])).toBe('a plain number');
    expect(formatDim(mulDim([1, 0, 0], [1, 0, 0]))).toBe('m2');
    expect(formatDim([1, 1, 0])).toBe('m*s');
    expect(formatDim([0, -2, 0])).toBe('1/s2');
    expect(sqrtDim([2, 0, 0])).toEqual([1, 0, 0]);
    expect(sqrtDim([1, 0, 0])).toBeNull();
    expect(toBase(180, 'deg')).toBeCloseTo(Math.PI, 15);
  });
});
