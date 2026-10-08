import { describe, expect, it } from 'vitest';
import { RUNOFF } from '@/engine/racing/car/runtime';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { distanceAt } from '../world/trackField';
import { worldFor } from '../world/worldData';
import { PIT_CANOPY, PIT_LANE, roofFront } from './dimensions';
import type { StadiumLayout } from './layout';

/** Closest the road comes to a rectangle in a building's frame (x along, z away from the road). */
function nearest(world: ReturnType<typeof worldFor>, l: StadiumLayout, side: number, along: number, offset: number, half: number, z0: number, z1: number): number {
  const c = Math.cos(l.yaw);
  const s = Math.sin(l.yaw);
  let best = Infinity;
  for (let u = -1; u <= 1; u += 0.02) {
    for (let v = 0; v <= 1; v += 0.1) {
      const a = along + u * half;
      const across = side * (offset + z0 + (z1 - z0) * v);
      best = Math.min(best, distanceAt(world.field, l.x + a * c + across * s, l.z - a * s + across * c));
    }
  }
  return best;
}

describe('stadium layout', () => {
  it('lines the buildings up with the main straight and keeps every roof and the pit lane behind the wall', () => {
    for (const spec of BUILT_IN_TRACKS) {
      const world = worldFor(buildTrack(spec));
      const { track, layout } = world;
      const wall = track.halfWidth + RUNOFF + 1.2;
      // The frame follows the road where it stands, not the corner where the loop was closed.
      const tangent = Math.atan2(track.ty[layout.index], track.tx[layout.index]);
      expect(Math.abs(Math.atan2(Math.sin(layout.yaw - tangent), Math.cos(layout.yaw - tangent)))).toBeLessThan(0.06);
      expect(layout.stands.length).toBeGreaterThan(0);
      for (const st of layout.stands) expect(nearest(world, layout, layout.side, st.along, st.offset, st.length / 2 + 0.6, roofFront().z, st.depth)).toBeGreaterThan(wall + 1);
      const pit = layout.pit;
      expect(pit).not.toBeNull();
      if (!pit) continue;
      expect(nearest(world, layout, -layout.side, pit.along, pit.offset, pit.length / 2 + 0.6, -PIT_CANOPY, pit.depth)).toBeGreaterThan(wall + 1);
      // The lane may tuck under the wall's back, never past its road face.
      expect(nearest(world, layout, -layout.side, pit.along, pit.offset, pit.laneHalf ?? 0, -PIT_LANE, 0)).toBeGreaterThan(wall - 0.3);
    }
  });
});
