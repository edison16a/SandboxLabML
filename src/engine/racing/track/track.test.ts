import { describe, expect, it } from 'vitest';
import { buildTrack } from './buildTrack';
import { BUILT_IN_TRACKS } from './presets';
import { randomTrackSpec } from './randomTrack';
import { circle } from './shapes';
import { checkTrack, MIN_RADIUS } from './validate';

describe('buildTrack', () => {
  it('measures curvature 0.02 per meter on a 50 m circle, within 1%', () => {
    const t = buildTrack({ id: 'c', name: 'c', width: 8, points: circle(50, 48) });
    for (let i = 0; i < t.count; i += 7) expect(t.curvature[i]).toBeCloseTo(0.02, 3);
    const mean = t.curvature.reduce((a, b) => a + b, 0) / t.count;
    expect(Math.abs(mean - 0.02) / 0.02).toBeLessThan(0.01);
  });

  it('places checkpoints 10 m apart along the centerline', () => {
    const t = buildTrack(BUILT_IN_TRACKS[1]);
    for (let k = 1; k < t.checkpoints.length; k++) {
      const gap = t.s[t.checkpoints[k]] - t.s[t.checkpoints[k - 1]];
      expect(gap).toBeGreaterThan(9.9);
      expect(gap).toBeLessThan(10.1);
    }
  });

  it('samples about once per meter', () => {
    const t = buildTrack(BUILT_IN_TRACKS[0]);
    expect(t.spacing).toBeGreaterThan(0.99);
    expect(t.spacing).toBeLessThan(1.01);
  });

  it('puts the edges half a width from the centerline', () => {
    const t = buildTrack(BUILT_IN_TRACKS[2]);
    for (let i = 0; i < t.count; i += 13) {
      expect(Math.hypot(t.leftX[i] - t.cx[i], t.leftY[i] - t.cy[i])).toBeCloseTo(t.halfWidth, 6);
    }
  });

  it('casts a ray to the nearest edge', () => {
    const t = buildTrack({ id: 'c', name: 'c', width: 10, points: circle(50, 48) });
    // From the centerline at angle 0 the outer edge is 5 m away along +x.
    const d = t.grid.raycast(50, 0, 1, 0, 60);
    expect(d).toBeCloseTo(5, 1);
    expect(t.grid.raycast(50, 0, 0, 1, 1)).toBe(1);
  });
});

describe('built-in tracks', () => {
  for (const spec of BUILT_IN_TRACKS) {
    it(`${spec.name} is drivable and does not cross itself`, () => {
      const problems = checkTrack(buildTrack(spec));
      expect(problems.minRadius).toBeGreaterThanOrEqual(MIN_RADIUS);
      expect(problems.selfIntersects).toBe(false);
    });
  }
});

describe('random tracks', () => {
  it('are deterministic and always valid', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const spec = randomTrackSpec(seed);
      expect(randomTrackSpec(seed)).toEqual(spec);
      const problems = checkTrack(buildTrack(spec));
      expect(problems.tooTight).toBe(false);
      expect(problems.selfIntersects).toBe(false);
    }
  });
});
