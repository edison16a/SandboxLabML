import { describe, expect, it } from 'vitest';
import { CutClock } from './cut';

const CUT = { hold: 4, fadeOut: 4, dark: 2, fadeIn: 4 };

describe('the cut between hero episodes', () => {
  it('opens fully shown when the page opens on an episode', () => {
    const c = new CutClock(CUT);
    c.start(true);
    expect(c.darkness()).toBe(0);
  });

  it('starts a new episode in the dark and brings it up smoothly', () => {
    const c = new CutClock(CUT);
    c.start(false);
    expect(c.dark).toBe(true);
    c.step(false);
    c.step(false);
    expect(c.darkness()).toBe(1);
    const seen: number[] = [];
    for (let k = 0; k < 5; k++) {
      c.step(false);
      seen.push(c.darkness());
    }
    for (let k = 1; k < seen.length; k++) expect(seen[k]).toBeLessThanOrEqual(seen[k - 1]);
    expect(seen.at(-1)).toBe(0);
  });

  it('holds after the agent stops, dips to dark, and only then moves on', () => {
    const c = new CutClock(CUT);
    c.start(true);
    expect(c.step(true)).toBe(false);
    let ticks = 1;
    while (!c.step(true)) {
      ticks++;
      if (ticks <= CUT.hold) expect(c.darkness()).toBe(0);
    }
    expect(ticks).toBe(CUT.hold + CUT.fadeOut + 2);
    expect(c.darkness(-1)).toBe(1);
  });

  it('moves the dip between ticks too, so it never steps', () => {
    const c = new CutClock(CUT);
    c.start(false);
    c.step(false);
    c.step(false);
    c.step(false);
    expect(c.darkness(0.5)).toBeLessThan(c.darkness(0));
    expect(c.darkness(0.5)).toBeGreaterThan(c.darkness(1));
  });
});
