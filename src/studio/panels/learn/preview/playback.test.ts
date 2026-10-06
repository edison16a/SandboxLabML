import { describe, expect, it } from 'vitest';
import { advance, frameAt, HOLD_SECONDS, lerpAngle, MAX_STEP_MS, secondsAt, TICKS_PER_SECOND } from './playback';

describe('preview playback', () => {
  it('plays 30 ticks a second of wall time', () => {
    expect(advance(0, 1000 / 30, 900)).toBeCloseTo(1, 9);
    expect(advance(10, 50, 900)).toBeCloseTo(11.5, 9);
  });

  it('carries on after a stall instead of jumping ahead', () => {
    expect(advance(10, 5000, 900)).toBeCloseTo(10 + (MAX_STEP_MS / 1000) * TICKS_PER_SECOND, 9);
  });

  it('holds the last frame for a moment, then starts over', () => {
    const end = 899;
    const held = advance(end, 1000, 900);
    expect(held).toBeGreaterThan(end);
    expect(frameAt(held, 900)).toEqual({ i: 899, j: 899, f: 0 });
    let pos = end;
    for (let k = 0; k < HOLD_SECONDS * 30 + 2; k++) pos = advance(pos, 1000 / 30, 900);
    expect(pos).toBeLessThan(3);
  });

  it('finds the frames around the playhead', () => {
    expect(frameAt(4.25, 10)).toEqual({ i: 4, j: 5, f: 0.25 });
    expect(frameAt(-3, 10)).toEqual({ i: 0, j: 1, f: 0 });
    expect(frameAt(3, 1)).toEqual({ i: 0, j: 0, f: 0 });
    expect(secondsAt(29, 900)).toBeCloseTo(1, 9);
  });

  it('turns the short way round', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 6);
    expect(lerpAngle(0.2, 0.6, 0.5)).toBeCloseTo(0.4, 9);
  });
});
