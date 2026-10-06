import { describe, expect, it } from 'vitest';
import { createPacer } from './pacing';

/** Counts the frames that draw over `seconds` of a display at `hz`, with a little timestamp jitter. */
function drawn(fps: number, hz: number, seconds = 2, jitter = 0.8): number {
  const pace = createPacer(fps);
  let count = 0;
  const frames = Math.round(hz * seconds);
  for (let i = 0; i < frames; i++) {
    const wobble = (i % 2 === 0 ? 1 : -1) * jitter;
    if (pace(1000 + (i * 1000) / hz + wobble)) count++;
  }
  return count / seconds;
}

describe('createPacer', () => {
  it('draws every frame when the cap matches the display', () => {
    expect(drawn(60, 60)).toBe(60);
  });

  it('draws every other frame for 30 on a 60 Hz display', () => {
    expect(drawn(30, 60)).toBe(30);
  });

  it('holds the average on the cap when the display rate is not a multiple', () => {
    expect(drawn(60, 144)).toBeCloseTo(60, -1);
    expect(drawn(30, 144)).toBeCloseTo(30, -1);
    expect(drawn(60, 120)).toBe(60);
  });

  it('draws every frame of a display slower than the cap', () => {
    expect(drawn(60, 50)).toBe(50);
  });

  it('draws right away after a stall without a burst of catch up frames', () => {
    const pace = createPacer(30);
    expect(pace(0)).toBe(true);
    expect(pace(16.7)).toBe(false);
    expect(pace(5000)).toBe(true);
    expect(pace(5016.7)).toBe(false);
    expect(pace(5033.3)).toBe(true);
  });
});
