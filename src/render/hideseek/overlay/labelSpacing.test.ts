import { describe, expect, it } from 'vitest';
import { LabelSpacing } from './labelSpacing';

describe('distance chip spacing', () => {
  it('skips a chip too near one already placed, and starts fresh each frame', () => {
    const s = new LabelSpacing(4, 40);
    expect(s.claim(100, 100)).toBe(true);
    expect(s.claim(120, 110)).toBe(false);
    expect(s.claim(150, 100)).toBe(true);
    s.clear();
    expect(s.claim(120, 110)).toBe(true);
  });

  it('never claims more spots than it holds', () => {
    const s = new LabelSpacing(2, 10);
    expect(s.claim(0, 0)).toBe(true);
    expect(s.claim(100, 0)).toBe(true);
    expect(s.claim(200, 0)).toBe(false);
  });
});
