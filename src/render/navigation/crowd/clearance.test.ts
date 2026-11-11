import { describe, expect, it } from 'vitest';
import { hidesChampion, SIGHT_LENGTH, SIGHT_WIDTH } from './clearance';

describe('keeping the champion in sight', () => {
  // Camera toward +z of a champion at the origin.
  const near = (x: number, z: number) => hidesChampion(x, z, 0, 0, 0, 1, 0.85);

  it('clears members right by the champion', () => {
    expect(near(0.5, -0.5)).toBe(true);
    expect(near(-0.9, -0.2)).toBe(false);
  });

  it('clears a short strip toward the camera and nothing behind the champion', () => {
    expect(near(0.2, SIGHT_LENGTH - 0.1)).toBe(true);
    expect(near(SIGHT_WIDTH + 0.05, 1.2)).toBe(false);
    expect(near(0, SIGHT_LENGTH + 0.2)).toBe(false);
    expect(near(0, -1.2)).toBe(false);
  });
});
