import { describe, expect, it } from 'vitest';
import { cutoutPath, frameAround, restingHole, roundedRectPath, unionBox } from './geometry';

const view = { w: 1000, h: 800 };

describe('unionBox', () => {
  it('covers every box', () => {
    expect(unionBox([])).toBeNull();
    expect(unionBox([{ x: 10, y: 20, w: 30, h: 40 }, { x: 100, y: 5, w: 10, h: 10 }])).toEqual({ x: 10, y: 5, w: 100, h: 55 });
  });
});

describe('frameAround', () => {
  it('pads the target', () => {
    expect(frameAround({ x: 100, y: 100, w: 50, h: 20 }, 6, view)).toEqual({ x: 94, y: 94, w: 62, h: 32 });
  });

  it('keeps the frame inside the window', () => {
    expect(frameAround({ x: 0, y: 48, w: 600, h: 760 }, 6, view)).toEqual({ x: 2, y: 42, w: 604, h: 756 });
  });

  it('gives nothing for a target off screen', () => {
    expect(frameAround({ x: 100, y: 900, w: 50, h: 20 }, 6, view)).toBeNull();
  });
});

describe('paths', () => {
  it('rests at the middle of the window with no size', () => {
    expect(restingHole(view)).toEqual({ x: 500, y: 400, w: 0, h: 0 });
  });

  it('draws the window and then the rounded hole', () => {
    const d = cutoutPath(view, { x: 10, y: 20, w: 100, h: 50 }, 8);
    expect(d.startsWith('M0 0H1000V800H0Z')).toBe(true);
    expect(d).toContain('M18 20');
    expect((d.match(/A8 8/g) ?? []).length).toBe(4);
  });

  it('shrinks the corners to fit a small hole', () => {
    expect(roundedRectPath({ x: 0, y: 0, w: 6, h: 40 }, 10)).toContain('A3 3');
    expect(roundedRectPath({ x: 5, y: 5, w: 0, h: 0 }, 10)).toBe('M5 5H5V5H5Z');
  });
});
