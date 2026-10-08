import { describe, expect, it } from 'vitest';
import { createPaneView } from '../stage/paneView';
import { clampAim, HERO_ELEVATION, heroFrame, PX_PER_M } from './heroArenaShot';

/** A pane of `w` x `h` px whose free zone is the given shares of it. */
function pane(w: number, h: number, zoneW: number, zoneH: number) {
  const p = createPaneView();
  Object.assign(p.rect, { x: 0, y: 0, w, h });
  p.zoneW = zoneW;
  p.zoneH = zoneH;
  return p;
}

describe('the hero arena shot', () => {
  it('shows the free zone at about PX_PER_M, across and deep', () => {
    const f = heroFrame(pane(800, 952, 0.62, 1), 38, HERO_ELEVATION, { distance: 0, across: 0, deep: 0 });
    expect(f.across).toBeCloseTo((0.62 * 800) / PX_PER_M, 0);
    // The floor runs away from the camera, so the zone covers more of it deep than across.
    expect(f.deep).toBeGreaterThan(f.across);
  });

  it('keeps the shot on the room near a wall, without losing the player', () => {
    const f = { distance: 20, across: 8, deep: 12 };
    const aim = clampAim(9.5, 0, 0, f, 10.4, { x: 0, z: 0 });
    // Looking along -z, the room's +x wall is at the right edge: the aim moves in from the player.
    expect(aim.x).toBeLessThan(9.5);
    expect(9.5 - aim.x).toBeLessThanOrEqual(0.6 * 4 + 1e-9);
  });

  it('follows the player freely in the middle of the room', () => {
    const f = { distance: 20, across: 8, deep: 8 };
    const aim = clampAim(1, -2, 0.7, f, 10.4, { x: 0, z: 0 });
    expect(aim.x).toBeCloseTo(1);
    expect(aim.z).toBeCloseTo(-2);
  });
});
