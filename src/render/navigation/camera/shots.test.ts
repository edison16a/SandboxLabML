import { describe, expect, it } from 'vitest';
import { CENTER_PULL, followAim, followAzimuth, followShot, followSide, SWING_AT } from './shots';

describe('follow shot side', () => {
  it('keeps to the side of the near wall, with a dead band so it never flickers', () => {
    expect(followSide(0, 1)).toBe(1);
    expect(followSide(0, -1)).toBe(-1);
    expect(followSide(SWING_AT + 0.1, -1)).toBe(1);
    expect(followSide(SWING_AT - 0.1, -1)).toBe(-1);
    expect(followSide(-SWING_AT - 0.1, 1)).toBe(-1);
  });

  it('aims ahead of the runner, pulled toward the middle and never past the finish', () => {
    const a = { x: 0, z: 0 };
    followAim(0, 6, 15, 7, a);
    expect(a.z).toBeCloseTo(6 * (1 - CENTER_PULL), 9);
    expect(a.x).toBeGreaterThan(0);
    followAim(14.5, 0, 15, 7, a);
    expect(a.x).toBe(12);
  });

  it('mirrors the shot across the runner: same distance behind, opposite side', () => {
    const a = followAzimuth(1);
    const b = followAzimuth(-1);
    expect(Math.sin(a)).toBeCloseTo(Math.sin(b), 9);
    expect(Math.cos(a)).toBeCloseTo(-Math.cos(b), 9);
    // A runner by the -z wall is seen from over that wall, looking across the room toward its middle.
    const shot = followShot(0, -6, 15, 7, followSide(-6, 1));
    expect(shot.pz).toBeLessThan(shot.tz);
    expect(shot.px).toBeLessThan(shot.tx);
    expect(shot.tz).toBeGreaterThan(-6);
  });
});
