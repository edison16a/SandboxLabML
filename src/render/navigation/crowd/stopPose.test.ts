import { describe, expect, it } from 'vitest';
import { FLAG_CRUSHED, FLAG_SPIKED, NAV_DIED, NAV_FINISHED, NAV_RUNNING, NAV_STOPPED } from '@/engine/navigation/agent';
import { createStopPose, FADE_START, stopPose } from './stopPose';

describe('how a run ends on screen', () => {
  const p = createStopPose();

  it('leaves a runner as it is', () => {
    stopPose(NAV_RUNNING, 0, 5, p);
    expect(p).toMatchObject({ tip: 0, squash: 1, spread: 1, lift: 0, spin: 0, alpha: 1, grey: 0, airborne: false, flash: 0 });
  });

  it('jolts a spiked runner up and drops it onto its back, then fades it, and never jerks', () => {
    let last = 0;
    for (let a = 0; a <= 0.5; a += 0.02) {
      stopPose(NAV_DIED, FLAG_SPIKED, a, p);
      expect(Math.abs(p.tip)).toBeGreaterThanOrEqual(last - 1e-9);
      last = Math.abs(p.tip);
    }
    stopPose(NAV_DIED, FLAG_SPIKED, 0.15, p);
    expect(p.airborne).toBe(true);
    expect(p.flash).toBeGreaterThan(0.5);
    stopPose(NAV_DIED, FLAG_SPIKED, FADE_START.died - 0.01, p);
    expect(p.tip).toBeLessThan(-1.3);
    expect(p.lift).toBeGreaterThan(0.25);
    expect(p.alpha).toBe(1);
    expect(p.flash).toBe(0);
    stopPose(NAV_DIED, FLAG_SPIKED, 3, p);
    expect(p.alpha).toBe(0);
  });

  it('flattens a crushed runner at once', () => {
    stopPose(NAV_DIED, FLAG_CRUSHED, 0.2, p);
    expect(p.squash).toBeLessThan(0.35);
    expect(p.spread).toBeGreaterThan(1.3);
    expect(p.tip).toBe(0);
  });

  it('hops and turns a finisher, then fades it past the line', () => {
    stopPose(NAV_FINISHED, 0, 0.18, p);
    expect(p.lift).toBeGreaterThan(0.1);
    expect(p.airborne).toBe(true);
    stopPose(NAV_FINISHED, 0, 1.5, p);
    expect(p.lift).toBe(0);
    expect(p.spin).toBeCloseTo(Math.PI * 2, 6);
    expect(p.alpha).toBeLessThan(1);
  });

  it('greys and fades a runner that ran out of time', () => {
    stopPose(NAV_STOPPED, 0, 0.6, p);
    expect(p.grey).toBeGreaterThan(0.5);
    expect(p.alpha).toBeLessThan(1);
  });
});
