import { describe, expect, it } from 'vitest';
import { RUNOFF } from '@/engine/racing/car/runtime';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { STRIDE } from './flora/placement';
import { GROUND_LEVEL, terrainHeight } from './terrain/terrainHeight';
import { distanceAt, insideAt } from './trackField';
import { worldFor } from './worldData';

const tracks = BUILT_IN_TRACKS.map((spec) => buildTrack(spec));

describe('racing world', () => {
  it('measures distance to the road close to the truth', () => {
    const track = tracks[0];
    const { field } = worldFor(track);
    for (let i = 0; i < track.count; i += 37) {
      // A point 20 m to the left of the centerline.
      const x = track.cx[i] - track.ty[i] * 20;
      const z = -(track.cy[i] + track.tx[i] * 20);
      expect(Math.abs(distanceAt(field, x, z) - 20)).toBeLessThan(1.5);
    }
  });

  it('knows the infield from the outside', () => {
    const track = tracks[0];
    const { field } = worldFor(track);
    expect(insideAt(field, field.centerX, field.centerZ)).toBe(true);
    expect(insideAt(field, field.centerX + field.extentX + 200, field.centerZ)).toBe(false);
  });

  it('keeps the ground level under the road, run-off and barriers on every track', () => {
    for (const track of tracks) {
      const { shape } = worldFor(track);
      for (let i = 0; i < track.count; i += 5) {
        for (const off of [-1, 0, 1].map((s) => s * (track.halfWidth + RUNOFF + 2))) {
          const x = track.cx[i] - track.ty[i] * off;
          const z = -(track.cy[i] + track.tx[i] * off);
          expect(terrainHeight(shape, x, z)).toBeCloseTo(GROUND_LEVEL, 3);
        }
      }
    }
  });

  it('grows hills and a horizon away from the road', () => {
    const track = tracks[4];
    const { shape, field } = worldFor(track);
    let highest = -Infinity;
    for (let a = 0; a < Math.PI * 2; a += 0.2) highest = Math.max(highest, terrainHeight(shape, field.centerX + Math.cos(a) * 2500, field.centerZ + Math.sin(a) * 2500));
    expect(highest).toBeGreaterThan(120);
  });

  it('never puts a tree, shrub or rock near the road', () => {
    for (const track of tracks) {
      const { flora, field } = worldFor(track);
      const minimum = track.halfWidth + RUNOFF + 6;
      for (const items of [flora.pines, flora.broadleaf, flora.shrubs, flora.rocks]) {
        for (let k = 0; k < items.length; k += STRIDE) expect(distanceAt(field, items[k], items[k + 2])).toBeGreaterThan(minimum);
      }
      expect(flora.pines.length / STRIDE).toBeGreaterThan(200);
    }
  });

  it('is the same world every time for the same track', () => {
    const a = worldFor(buildTrack(BUILT_IN_TRACKS[1]));
    const b = worldFor(tracks[1]);
    expect(Array.from(a.flora.pines.slice(0, 16))).toEqual(Array.from(b.flora.pines.slice(0, 16)));
  });
});
