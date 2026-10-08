import { describe, expect, it } from 'vitest';
import { RUNOFF } from '@/engine/racing/car/runtime';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { terrainHeight } from '../world/terrain/terrainHeight';
import { distanceAt } from '../world/trackField';
import { padWeight } from '../stadium/layout';
import { PIT_TOP } from '../stadium/dimensions';
import { worldFor } from '../world/worldData';
import { canSee, keepOut, occluders } from './sightLines';
import { ahead, pickStation, trackStations } from './stations';

describe('trackside cameras', () => {
  it('stand clear of the road, above the ground, all the way round every track', () => {
    for (const spec of BUILT_IN_TRACKS) {
      const world = worldFor(buildTrack(spec));
      const stations = trackStations(world);
      expect(stations.length).toBeGreaterThan(world.track.length / 200);
      for (const s of stations) {
        expect(distanceAt(world.field, s.x, s.z)).toBeGreaterThan(world.track.halfWidth + RUNOFF + 3);
        expect(s.y).toBeGreaterThan(terrainHeight(world.shape, s.x, s.z) + 4);
      }
    }
  });

  it('never stand under the pit canopy or on the lane, and see the road they cover past every building', () => {
    for (const spec of BUILT_IN_TRACKS) {
      const world = worldFor(buildTrack(spec));
      const { track, layout, shape } = world;
      const keep = keepOut(layout, 0);
      const blockers = occluders(layout);
      for (const st of trackStations(world)) {
        // Only the camera up on the pit canopy may stand over the pits.
        if (st.y < PIT_TOP) expect(keep.every((p) => padWeight(p, st.x, st.z, 0.01) === 0)).toBe(true);
        const i = Math.round(st.s / track.spacing);
        for (let d = -90; d <= 40; d += 5) {
          const j = (i + Math.round(d / track.spacing) + track.count) % track.count;
          expect(canSee(shape, blockers, st.x, st.y, st.z, track.cx[j], -track.cy[j])).toBe(true);
        }
      }
    }
  });

  it('cut from camera to camera as the car drives round, never to one far down the road', () => {
    const world = worldFor(buildTrack(BUILT_IN_TRACKS[0]));
    const stations = trackStations(world);
    const len = world.track.length;
    let current = -1;
    let cuts = 0;
    for (let s = 0; s < len * 2; s += 2) {
      const next = pickStation(stations, current, s % len, len);
      if (next !== current) {
        cuts++;
        // A fresh shot always starts with the car close to, or just past, its camera.
        const gap = ahead(s % len, stations[next].s, len);
        expect(gap <= 60 || len - gap <= 40).toBe(true);
      }
      current = next;
    }
    expect(cuts).toBeGreaterThanOrEqual(stations.length);
  });
});
