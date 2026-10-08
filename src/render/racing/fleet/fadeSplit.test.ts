import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { apart, clearance } from './clearance';
import { FadeSplit } from './fadeSplit';

describe('fading the pack off the followed car', () => {
  it('eases a car out over a few frames instead of cutting it, then drops it', () => {
    const split = new FadeSplit(4);
    const seen: number[] = [];
    for (let k = 0; k < 60; k++) {
      split.begin(1 / 60);
      seen.push(split.place(0, 0));
    }
    expect(seen[0]).toBeGreaterThan(0.7);
    expect(seen[6]).toBeGreaterThan(0.08);
    expect(seen[6]).toBeLessThan(0.3);
    expect(seen[59]).toBe(0);
    expect(split.solidCount + split.fadeCount).toBe(0);
    // Coming back takes longer than leaving, so nothing pops in.
    split.begin(1 / 60);
    expect(split.place(0, 1)).toBeLessThan(1 - seen[0]);
  });

  it('files cars as solid, fading or gone, and snaps the one the detailed car replaces', () => {
    const split = new FadeSplit(4);
    split.begin(1 / 60);
    split.place(0, 1);
    split.place(1, 0.5);
    split.place(2, 0, true);
    expect(Array.from(split.solid.slice(0, split.solidCount))).toEqual([0]);
    expect(Array.from(split.fading.slice(0, split.fadeCount))).toEqual([1]);
    expect(split.shown[2]).toBe(0);
  });

  it('clears cars at the lens, on the line of sight and inside the followed car, and keeps the rest', () => {
    const cam = new THREE.Vector3(0, 3, 0);
    const focus = new THREE.Vector3(10, 0, 0);
    expect(clearance(1, 0.5, focus, 0, cam)).toBe(0);
    expect(clearance(7, 0.4, focus, 0, cam)).toBe(0);
    expect(clearance(7, 6, focus, 0, cam)).toBe(1);
    expect(clearance(30, 0, focus, 0, cam)).toBe(1);
    // Half a car ahead on the same line overlaps it; a car in the next lane does not.
    expect(clearance(12, 0.3, focus, 0, cam)).toBe(0);
    expect(apart(10.5, 2.6, focus, 0)).toBe(1);
    expect(apart(12.5, -0.2, focus, Math.PI / 2)).toBe(1);
  });
});
