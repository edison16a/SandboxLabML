import { describe, expect, it } from 'vitest';
import { compileScript } from '../compiler';
import { SCRIPT_PRESETS } from '../presets';

const HEAD = 'script "t" for driving v1\nbrain driving-standard\n';
const GEN = '\neach generation {\n  speciate(target: 8)\n  select(top: 20%)\n  breed(crossover: 0.75)\n  keepChampions()\n}\n';
const script = (tick: string, extra = '', gen = GEN) => `${HEAD}${extra}\neach tick {\n${tick}\n}\n${gen}`;
const DRIVE = '  drive(steer: brain.steer, pedal: brain.pedal)';
const GOOD = `${DRIVE}\n  reward +1 * route.gain`;

function warnings(source: string): string[] {
  const r = compileScript(source);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.diagnostics.filter((d) => d.severity !== 'error').map((d) => d.code);
}

describe('lint', () => {
  it('presets are clean', () => {
    for (const p of SCRIPT_PRESETS) expect(warnings(p.source), p.id).toEqual([]);
  });

  it('warns when no reward is about progress', () => {
    expect(warnings(script(`${DRIVE}\n  reward 0.01 * car.speed`))).toEqual(['no-progress-reward']);
    expect(warnings(script(`${DRIVE}\n  reward 0.02 * route.gain / 1 m`))).toEqual([]);
  });

  it('warns when one reward is over 100 times the others', () => {
    expect(warnings(script(`${GOOD}\n  reward +500 when car.arrived`))).toEqual(['dominant-reward']);
    expect(warnings(script(`${GOOD}\n  reward +100 when car.arrived`))).toEqual([]);
  });

  it('warns about lets that are never used', () => {
    expect(warnings(script(`${GOOD}\n  let gap = 2 m`))).toEqual(['unused']);
    expect(warnings(script(GOOD, 'let limit = 3 s\n'))).toEqual(['unused']);
    expect(warnings(script(`${GOOD}\n  stop "stuck" when car.noProgress > limit`, 'let limit = 3 s\n'))).toEqual([]);
  });

  it('warns about a sensor that always reads the same', () => {
    expect(warnings(script(GOOD, 'sensor flat "Flat" in 0 .. 1 = 0.5\n'))).toEqual(['constant-sensor']);
  });

  it('warns about stops that can never fire, or fire at once', () => {
    expect(warnings(script(`${GOOD}\n  stop "fast" when car.speed > 100 m/s`))).toEqual(['never-true']);
    expect(warnings(script(`${GOOD}\n  stop "fast" when 100 m/s < car.speed`))).toEqual(['never-true']);
    expect(warnings(script(`${GOOD}\n  stop "fast" when car.speed > 15 m/s`))).toEqual([]);
    expect(warnings(script(`${GOOD}\n  stop "never" when false`))).toEqual(['never-true']);
    expect(warnings(script(`${GOOD}\n  stop "now" when 1 < 2`))).toEqual(['always-true']);
    expect(warnings(script(`${GOOD}\n  reward 1 when lane.offset > 20 m`))).toEqual(['never-true']);
  });

  it('warns when each tick never acts', () => {
    expect(warnings(script('  reward +1 * route.gain'))).toEqual(['no-action']);
    expect(warnings(`${HEAD}${GEN}`)).toEqual(['no-action']);
  });

  it('warns about generation operators left at their defaults', () => {
    expect(warnings(script(GOOD, '', '\neach generation {\n  speciate(target: 8)\n}\n'))).toEqual(['missing-operators']);
    expect(compileScript(script(GOOD, '', '')).diagnostics.map((d) => [d.severity, d.code])).toEqual([['info', 'no-generation']]);
  });

  it('warns when a script is expensive', () => {
    const heavy = `${GOOD}\n  repeat 64 {\n    for each r in lidar {\n      reward -0.1 when r < 2 m\n    }\n  }`;
    expect(warnings(script(heavy))).toEqual(['high-cost']);
  });
});
