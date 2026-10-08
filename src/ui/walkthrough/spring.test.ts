import { describe, expect, it } from 'vitest';
import { createSpring, glide, isSettled, snapSpring, stepSpring } from './spring';

describe('spring', () => {
  it('glides to the target and settles there', () => {
    const s = createSpring([0, 0]);
    const target = [400, -120];
    let frames = 0;
    while (!isSettled(s, target) && frames < 600) {
      stepSpring(s, target, 1 / 60);
      frames++;
    }
    expect(isSettled(s, target)).toBe(true);
    // About a second at 60 frames a second: quick, and still a glide rather than a jump.
    expect(frames).toBeGreaterThan(20);
    expect(frames).toBeLessThan(90);
  });

  it('does not overshoot the target', () => {
    const s = createSpring([0]);
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      stepSpring(s, [100], 1 / 60);
      peak = Math.max(peak, s.value[0]);
    }
    expect(peak).toBeLessThan(100.5);
  });

  it('keeps time on a slow page but never jumps to the end after a long pause', () => {
    const slow = createSpring([0]);
    const fast = createSpring([0]);
    stepSpring(slow, [1000], 0.1);
    for (let i = 0; i < 6; i++) stepSpring(fast, [1000], 1 / 60);
    expect(slow.value[0]).toBeCloseTo(fast.value[0], 0);
    const paused = createSpring([0]);
    stepSpring(paused, [1000], 30);
    expect(paused.value[0]).toBeGreaterThan(0);
    expect(paused.value[0]).toBeLessThan(990);
  });

  it('lands exactly on the target once close', () => {
    const s = createSpring([0, 0]);
    let frames = 0;
    while ((s.value[0] !== 240 || s.value[1] !== 80) && frames < 200) {
      glide(s, [240, 80], 1 / 60);
      frames++;
    }
    expect(s.value).toEqual([240, 80]);
    expect(frames).toBeLessThan(80);
  });

  it('follows a target that moves while it glides', () => {
    const s = createSpring([0]);
    for (let i = 0; i < 20; i++) stepSpring(s, [100], 1 / 60);
    for (let i = 0; i < 200; i++) stepSpring(s, [50], 1 / 60);
    expect(s.value[0]).toBeCloseTo(50, 1);
  });

  it('snaps straight to the target', () => {
    const s = createSpring([0, 0]);
    s.velocity[0] = 30;
    snapSpring(s, [5, 6]);
    expect(s.value).toEqual([5, 6]);
    expect(isSettled(s, [5, 6])).toBe(true);
  });
});
