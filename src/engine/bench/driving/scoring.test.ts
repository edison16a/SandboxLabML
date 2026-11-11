import { describe, expect, it } from 'vitest';
import type { DrivingResult } from '../../driving/results';
import type { DrivingExamCourse } from './exam';
import { DRIVING_WEIGHTS, drivingComposite, scoreTrip, SHORT_OF_ARRIVAL, tripsScore } from './scoring';

const course = { par: { time: 40, length: 200 } } as DrivingExamCourse;

function result(patch: Partial<DrivingResult>): DrivingResult {
  return {
    fitness: 0,
    distance: 200,
    completion: 1,
    arrived: true,
    crashed: false,
    hitPedestrian: false,
    stopReason: 'arrived',
    time: 40,
    redLightRuns: 0,
    stopLineOverruns: 0,
    speedingTime: 0,
    laneDepartureTime: 0,
    wrongWayTime: 0,
    hardBrakes: 0,
    curbTime: 0,
    safe: true,
    crashX: NaN,
    crashY: NaN,
    ...patch,
  };
}

describe('Driving scoring', () => {
  it('gives a clean arrival at autopilot pace full marks', () => {
    expect(scoreTrip(result({}), course)).toEqual({ completion: 1, safety: 1, efficiency: 1 });
  });

  it('weights add up to one', () => {
    expect(Object.values(DRIVING_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('never calls a crash safe, and gives it no pace', () => {
    const s = scoreTrip(result({ arrived: false, crashed: true, stopReason: 'crash', distance: 100, time: 20 }), course);
    expect(s.completion).toBeCloseTo(0.5);
    expect(s.safety).toBe(0);
    expect(s.efficiency).toBe(0);
  });

  it('scores driving through the destination clearly below arriving', () => {
    const through = scoreTrip(result({ arrived: false, safe: false, stopReason: 'lost', distance: 212, time: 30 }), course);
    expect(through.completion).toBe(SHORT_OF_ARRIVAL);
    expect(through.efficiency).toBe(0);
    expect(tripsScore(through)).toBeLessThan(tripsScore(scoreTrip(result({}), course)) - 20);
  });

  it('gives no pace credit for beating the autopilot through a red light', () => {
    const fast = scoreTrip(result({ redLightRuns: 1, safe: false, time: 30 }), course);
    expect(fast.efficiency).toBeCloseTo(0.5);
    expect(tripsScore(fast)).toBeLessThan(tripsScore(scoreTrip(result({}), course)) - 20);
    // Running two reds leaves nothing clean, so nothing for pace either.
    expect(scoreTrip(result({ redLightRuns: 2, safe: false, time: 30 }), course).efficiency).toBe(0);
  });

  it('does not call a parked SUV safe', () => {
    const s = scoreTrip(result({ arrived: false, stopReason: 'stuck', distance: 0, time: 15 }), course);
    expect(s).toEqual({ completion: 0, safety: 0, efficiency: 0 });
  });

  it('takes safety away for red lights and time breaking rules', () => {
    expect(scoreTrip(result({ redLightRuns: 1, safe: false }), course).safety).toBeCloseTo(0.5);
    expect(scoreTrip(result({ speedingTime: 10 }), course).safety).toBeCloseTo(0.75);
  });

  it('scores a slow arrival by the autopilot time over its own', () => {
    expect(scoreTrip(result({ time: 80 }), course).efficiency).toBeCloseTo(0.5);
  });

  it('scores generalization as the weaker city', () => {
    const good = { completion: 1, safety: 1, efficiency: 1 };
    const poor = { completion: 0.5, safety: 0.5, efficiency: 0.5 };
    const { radar, score } = drivingComposite([[good, good], [poor, poor]]);
    expect(radar.generalization).toBeCloseTo(tripsScore(poor) / 100);
    expect(radar.completion).toBeCloseTo(0.75);
    expect(score).toBeCloseTo(100 * (0.85 * 0.75 + 0.15 * 0.5));
  });
});
