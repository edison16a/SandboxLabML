import { describe, expect, it } from 'vitest';
import { braceDepth, scopeAt, unitContext } from './context';

const SRC = `script "t" for racing v1
sensor gap "Gap" in 0 m .. 60 m = rays.min
each tick {
  if car.speed > 3 m/s {
    re
  }
}
each generation {
  spec
}
`;

describe('cursor context', () => {
  it('knows whether the cursor is at the top, in each tick or in each generation', () => {
    expect(scopeAt(SRC, SRC.indexOf('sensor'))).toBe('top');
    expect(scopeAt(SRC, SRC.indexOf('re\n') + 2)).toBe('tick');
    expect(scopeAt(SRC, SRC.indexOf('spec') + 4)).toBe('generation');
    expect(scopeAt(SRC, SRC.length)).toBe('top');
  });

  it('works on half-typed text', () => {
    expect(scopeAt('script "t" for racing v1\neach tick {\n  reward (', 40)).toBe('tick');
  });

  it('counts unclosed braces outside strings and comments', () => {
    expect(braceDepth('each tick {\n  if x {')).toBe(2);
    expect(braceDepth('each tick {\n  stop "{" when x // {\n}')).toBe(0);
  });

  it('spots a number waiting for a unit', () => {
    expect(unitContext('  stop "s" when car.noProgress > 5 ')).toEqual({ unitFrom: 35 });
    expect(unitContext('  let a = 45 de')).toEqual({ unitFrom: 13 });
    expect(unitContext('  let ray1')).toBeNull();
    expect(unitContext('  let a = 45')).toBeNull();
  });
});
