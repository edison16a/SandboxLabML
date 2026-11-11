import { describe, expect, it } from 'vitest';
import { HIT_CAR, HIT_NONE } from '@/engine/driving/sensors/lidar';
import { focusSense } from './focusSense';
import { applyObserved, type ObservedInputs } from './observed';

function sensed() {
  const s = focusSense();
  s.beams = 3;
  s.range = 40;
  s.dist.set([30, 12, 8]);
  s.kind.set([HIT_CAR, HIT_CAR, HIT_CAR]);
  return s;
}

const observed: ObservedInputs = {
  prev: { index: 2, tick: 9, obs: Float32Array.from([0.25, 1, 0.25, 0.7]) },
  curr: { index: 2, tick: 10, obs: Float32Array.from([0.5, 1, 0.25, 0.7]) },
};

describe('the lidar the brain read', () => {
  it('replaces the drawn beams, blended between the two frames like the pose', () => {
    const s = sensed();
    applyObserved(s, observed, 2, 9, 10, 0.5);
    expect([...s.dist.slice(0, 3)]).toEqual([15, 40, 10]);
    expect(s.kind[1]).toBe(HIT_NONE);
    expect(s.kind[0]).toBe(HIT_CAR);
  });

  it('leaves the drawn beams alone for another SUV or another frame', () => {
    const other = sensed();
    applyObserved(other, observed, 1, 9, 10, 0.5);
    expect([...other.dist.slice(0, 3)]).toEqual([30, 12, 8]);
    const stale = sensed();
    applyObserved(stale, observed, 2, 10, 11, 0.5);
    expect([...stale.dist.slice(0, 3)]).toEqual([30, 12, 8]);
  });

  it('uses the latest frame alone when the one before belongs elsewhere', () => {
    const s = sensed();
    applyObserved(s, observed, 2, 3, 10, 0.5);
    expect([...s.dist.slice(0, 3)]).toEqual([20, 40, 10]);
  });
});
