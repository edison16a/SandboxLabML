import { describe, expect, it } from 'vitest';
import { clampScroll, onScreen, scrollNeeded } from './reveal';

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

describe('onScreen', () => {
  it('keeps a box that fits the window as it is', () => {
    expect(onScreen(100, 600, 844)).toEqual([100, 600]);
  });

  it('cuts a phone side panel off at the bottom of the screen, so its chart scrolls up into sight', () => {
    const [start, end] = onScreen(600, 1190, 844);
    expect(end).toBe(844);
    expect(scrollNeeded(980, 1160, start, end)).toBe(328);
  });
});

describe('clampScroll', () => {
  it('passes on a step the box can take', () => {
    expect(clampScroll(120, 0, 300)).toBe(120);
  });

  it('stops at the end of the box, leaving the rest to the box around it', () => {
    expect(clampScroll(348, 0, 141)).toBe(141);
    expect(clampScroll(-200, 50, 300)).toBe(-50);
  });
});
