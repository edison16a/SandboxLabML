import { describe, expect, it } from 'vitest';
import { classifyChange } from '../compiler';
import { findScriptPreset } from '../presets/racing';

const base = findScriptPreset('racing-intermediate')!.source;
const edit = (from: string, to: string) => {
  if (!base.includes(from)) throw new Error(`The preset no longer contains: ${from}`);
  return base.replace(from, to);
};

describe('classifyChange', () => {
  const cases: Array<[string, string, ReturnType<typeof classifyChange>]> = [
    ['nothing', base, 'none'],
    ['a comment', edit('// A big bonus for finishing a whole lap.', '// Laps matter most.'), 'comments'],
    ['a new comment line', edit('each tick {', '// hello\neach tick {'), 'comments'],
    ['spacing and blank lines', edit('reward +10 when lap.completed', 'reward   +10   when lap.completed\n\n\n'), 'comments'],
    ['a reward amount', edit('reward +10 when lap.completed', 'reward +20 when lap.completed'), 'live'],
    ['a new reward', edit('reward +1 when checkpoint.passed', 'reward +1 when checkpoint.passed\n  reward -0.1 when car.slip > 0.5'), 'live'],
    ['a stop rule', edit('car.noProgress > 3 s', 'car.noProgress > 4 s'), 'live'],
    ['a generation operator', edit('speciate(target: 8)', 'speciate(target: 12)'), 'live'],
    ['the script name', edit('"Intermediate: built-in reward"', '"Mine"'), 'live'],
    ['a let used only by a reward', edit('reward +10 when lap.completed', 'let bonus = 10\n  reward bonus when lap.completed'), 'live'],
    ['the brain', edit('brain racing-standard', 'brain racing-advanced'), 'fork'],
    ['a new sensor', edit('brain racing-standard', 'brain racing-standard\nsensor gap "Gap" in 0 m .. 60 m = rays.min'), 'fork'],
    ['the action mapping', edit('drive(steer: brain.steer, pedal: brain.pedal)', 'drive(steer: -brain.steer, pedal: brain.pedal)'), 'fork'],
    ['a let that feeds the action', edit('drive(steer: brain.steer, pedal: brain.pedal)', 'let p = brain.pedal * 0.5\n  drive(steer: brain.steer, pedal: p)'), 'fork'],
    ['a condition around the action', edit('drive(steer: brain.steer, pedal: brain.pedal)', 'if car.speed > 30 m/s {\n    drive(steer: brain.steer, pedal: 0)\n  } else {\n    drive(steer: brain.steer, pedal: brain.pedal)\n  }'), 'fork'],
    ['a script that no longer compiles', edit('reward +10 when lap.completed', 'reward +10 when lap.complete'), 'fork'],
  ];

  for (const [name, next, expected] of cases) {
    it(`classifies a change to ${name} as ${expected}`, () => {
      expect(classifyChange(base, next)).toBe(expected);
    });
  }

  it('a let feeding the action stays a fork when only its value changes', () => {
    const a = edit('drive(steer: brain.steer, pedal: brain.pedal)', 'let p = brain.pedal * 0.5\n  drive(steer: brain.steer, pedal: p)');
    expect(classifyChange(a, a.replace('* 0.5', '* 0.6'))).toBe('fork');
  });
});
