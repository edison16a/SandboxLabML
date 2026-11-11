import { describe, expect, it } from 'vitest';
import { ALL_RED, AXIS_EW, AXIS_NS, FLASH, GREEN, LIGHT_FLASHING, LIGHT_GREEN, LIGHT_RED, LIGHT_YELLOW, lightRemaining, lightState, SIGNAL_CYCLE, WALK, WALK_DONT, WALK_FLASHING, WALK_GO, walkState, YELLOW } from './plan';

describe('signal plan', () => {
  it('cycles green, yellow, red on each axis', () => {
    const seen: number[] = [];
    for (let t = 0; t < SIGNAL_CYCLE; t += 0.5) {
      const s = lightState(t, 0, AXIS_EW);
      if (seen[seen.length - 1] !== s) seen.push(s);
    }
    expect(seen).toEqual([LIGHT_GREEN, LIGHT_YELLOW, LIGHT_RED]);
    expect(lightState(0, 0, AXIS_NS)).toBe(LIGHT_RED);
    expect(lightState(GREEN + YELLOW + ALL_RED + 1, 0, AXIS_NS)).toBe(LIGHT_GREEN);
  });

  it('never shows green or yellow to both axes at once, and leaves an all red gap', () => {
    let allRed = 0;
    for (let t = 0; t < SIGNAL_CYCLE * 3; t += 0.1) {
      for (const offset of [0, 7.3, 31]) {
        const a = lightState(t, offset, AXIS_EW);
        const b = lightState(t, offset, AXIS_NS);
        expect(a === LIGHT_RED || b === LIGHT_RED).toBe(true);
        if (a === LIGHT_RED && b === LIGHT_RED) allRed++;
      }
    }
    expect(allRed).toBeGreaterThan(0);
  });

  it('lets people walk with the parallel green, then flashes, then stops them', () => {
    expect(walkState(1, 0, AXIS_EW)).toBe(WALK_GO);
    expect(walkState(WALK + 1, 0, AXIS_EW)).toBe(WALK_FLASHING);
    expect(walkState(WALK + FLASH + 1, 0, AXIS_EW)).toBe(WALK_DONT);
    // Whenever people may start crossing, the traffic they cross in front of has red.
    for (let t = 0; t < SIGNAL_CYCLE; t += 0.2) {
      if (walkState(t, 0, AXIS_NS) === WALK_GO) expect(lightState(t, 0, AXIS_EW)).toBe(LIGHT_RED);
    }
  });

  it('flashes yellow everywhere when signals are off', () => {
    expect(lightState(3, 0, AXIS_EW, false)).toBe(LIGHT_FLASHING);
    expect(lightState(3, 0, AXIS_NS, false)).toBe(LIGHT_FLASHING);
  });

  it('counts down to the next change', () => {
    expect(lightRemaining(0, 0, AXIS_EW)).toBeCloseTo(GREEN);
    expect(lightRemaining(GREEN + 1, 0, AXIS_EW)).toBeCloseTo(YELLOW - 1);
  });
});
