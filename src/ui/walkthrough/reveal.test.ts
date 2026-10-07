import { describe, expect, it } from 'vitest';
import { scrollNeeded } from './reveal';

describe('scrollNeeded', () => {
  it('leaves a target that already shows alone', () => {
    expect(scrollNeeded(100, 200, 0, 390)).toBe(0);
  });

  it('scrolls on to a button hidden past the end of a toolbar, with a little room', () => {
    expect(scrollNeeded(420, 520, 0, 390)).toBe(142);
  });

  it('scrolls back to a target before the start', () => {
    expect(scrollNeeded(-80, -20, 0, 390)).toBe(-92);
  });

  it('lines up the start of a target bigger than the box', () => {
    expect(scrollNeeded(-50, 600, 0, 390)).toBe(-62);
  });
});
