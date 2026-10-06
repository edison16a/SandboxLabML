import { describe, expect, it } from 'vitest';
import { stepCar } from '../../racing/car/dynamics';
import { DEFAULT_CAR } from '../../racing/car/params';
import { createRacingCar, updateTrackState } from '../../racing/car/runtime';
import { scriptedDriver } from '../../racing/scriptedDriver';
import { buildTrack } from '../../racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '../../racing/track/presets';
import { checkTrack, MIN_RADIUS } from '../../racing/track/validate';
import { examTracks } from '../exam';
import { startAt } from '../startOffset';
import { BENCH_HAND_BUILT, benchTrackSpecs } from '../tracks';

describe('benchmark roads', () => {
  it('are five, with the hand-built ones kept out of the public track list', () => {
    const specs = benchTrackSpecs();
    expect(specs).toHaveLength(5);
    const publicIds = new Set(BUILT_IN_TRACKS.map((t) => t.id));
    const publicShapes = new Set(BUILT_IN_TRACKS.map((t) => JSON.stringify(t.points)));
    for (const spec of BENCH_HAND_BUILT) {
      expect(publicIds.has(spec.id)).toBe(false);
      expect(publicShapes.has(JSON.stringify(spec.points))).toBe(false);
    }
    expect(benchTrackSpecs()).toEqual(specs);
  });

  for (const spec of benchTrackSpecs()) {
    it(`${spec.name} passes checkTrack`, () => {
      const problems = checkTrack(buildTrack(spec));
      expect(problems.minRadius).toBeGreaterThanOrEqual(MIN_RADIUS);
      expect(problems.selfIntersects).toBe(false);
    });
  }
});

describe('startAt', () => {
  const track = buildTrack(BENCH_HAND_BUILT[0]);

  it('keeps the road and moves only the start line', () => {
    const moved = startAt(track, 1 / 3);
    const shift = Math.round(track.count / 3);
    expect(moved.length).toBe(track.length);
    expect(moved.cx[0]).toBe(track.cx[shift]);
    expect(moved.cy[10]).toBe(track.cy[shift + 10]);
    expect(moved.curvature[track.count - shift]).toBe(track.curvature[0]);
    expect(Array.from(moved.checkpoints)).toEqual(Array.from(track.checkpoints));
    expect(moved.hash).not.toBe(track.hash);
    expect(startAt(track, 0)).toBe(track);
  });
});

describe('the scripted driver', () => {
  for (const exam of examTracks()) {
    it(`laps ${exam.label} from every start without leaving the road`, () => {
      for (const course of exam.courses) {
        const rc = createRacingCar(0, course.track, 0);
        const act = new Float64Array(2);
        let maxLateral = 0;
        while (rc.lap < 1 && rc.time < 90) {
          stepCar(rc.car, act[0], act[1], DEFAULT_CAR);
          updateTrackState(rc, course.track);
          maxLateral = Math.max(maxLateral, Math.abs(rc.pos.lateral));
          scriptedDriver(rc, course.track, DEFAULT_CAR, act);
        }
        expect(rc.lap).toBe(1);
        expect(maxLateral).toBeLessThan(course.track.halfWidth);
        expect(course.par.lapTime).toBeGreaterThan(0);
        expect(course.par.lapTime).toBeLessThanOrEqual(rc.lastLapTime);
      }
    });
  }
});
