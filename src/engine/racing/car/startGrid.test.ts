import { describe, expect, it } from 'vitest';
import { scriptedDriver } from '../scriptedDriver';
import { buildTrack } from '../track/buildTrack';
import { BUILT_IN_TRACKS } from '../track/presets';
import { stepCar } from './dynamics';
import { DEFAULT_CAR } from './params';
import { createRacingCar, updateTrackState } from './runtime';
import { gridSlot } from './startGrid';

const tracks = BUILT_IN_TRACKS.map(buildTrack);

describe('start grid', () => {
  it('puts slot 0 exactly where training starts every car', () => {
    const track = tracks[2];
    const rc = createRacingCar(0, track, 0, 7, 0);
    expect([rc.car.x, rc.car.y]).toEqual([track.cx[0], track.cy[0]]);
    expect(Object.is(rc.progress, 0)).toBe(true);
    expect(rc.pos).toEqual({ index: 0, s: 0, lateral: 0 });
  });

  for (const track of tracks) {
    it(`keeps 16 cars apart and on the road on ${track.spec.name}`, () => {
      const cars = Array.from({ length: 16 }, (_, k) => createRacingCar(k, track, 0, k, k));
      for (const rc of cars) {
        updateTrackState(rc, track);
        expect(rc.offTrack).toBe(false);
      }
      for (let a = 0; a < cars.length; a++) {
        for (let b = a + 1; b < cars.length; b++) {
          expect(Math.hypot(cars[a].car.x - cars[b].car.x, cars[a].car.y - cars[b].car.y)).toBeGreaterThan(4.5);
        }
      }
    });
  }

  it('starts later slots behind the line and counts their first lap from it', () => {
    const track = tracks[0];
    const slot = gridSlot(track, 5);
    expect(slot.back).toBeGreaterThan(25);
    expect(slot.back).toBeLessThan(35);
    const rc = createRacingCar(0, track, 0, 1, 5);
    expect(rc.progress).toBeCloseTo(-slot.back, 6);
    const act = new Float64Array(2);
    while (rc.lap < 1 && rc.time < 180) {
      stepCar(rc.car, act[0], act[1], DEFAULT_CAR);
      updateTrackState(rc, track);
      scriptedDriver(rc, track, DEFAULT_CAR, act);
      // The car must never look stalled while it rolls up to the line.
      expect(rc.noProgress).toBeLessThan(1);
    }
    expect(rc.lap).toBe(1);
    expect(rc.progress).toBeGreaterThanOrEqual(track.length);
  });
});
