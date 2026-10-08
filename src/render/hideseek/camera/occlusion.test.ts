import { describe, expect, it } from 'vitest';
import { anyBlocked, clearView, clearViewOf, sightBlocked, type ViewAngle } from './occlusion';
import { WallDodge } from './wallDodge';

/** A 2.5 m wall 0.2 m thick running along z, its near face 0.9 m from the agent at the origin, on the +x side. */
const WALL = [{ x: 1, z: 0, hx: 0.1, hz: 5 }];
const TOP = 2.5;
const UP = (57 * Math.PI) / 180;

describe('follow camera occlusion', () => {
  it('sees a wall between an agent and a camera behind it, and nothing over the top', () => {
    // From the +x side, the sight line crosses the wall at about 2.3 m: blocked.
    expect(sightBlocked(0, 0.9, 0, 3.5, 6.4, 0, WALL, TOP)).toBe(true);
    // From the -x side, or high enough, it is clear.
    expect(sightBlocked(0, 0.9, 0, -3.5, 6.4, 0, WALL, TOP)).toBe(false);
    expect(sightBlocked(0, 0.9, 0, 1.5, 6.4, 0, WALL, TOP)).toBe(false);
    // A wall past the camera does not count.
    expect(sightBlocked(0, 0.9, 0, 0.5, 6.4, 0, WALL, TOP)).toBe(false);
  });

  it('turns the camera round the agent to the nearest clear side', () => {
    const out: ViewAngle = { azimuth: 0, elevation: 0 };
    // Looking from +x (azimuth 90 degrees) is blocked; the nearest clear view turns toward +z or -z.
    expect(clearView(0, 0.9, 0, 6.5, { azimuth: Math.PI / 2, elevation: UP }, WALL, TOP, out)).toBe(true);
    expect(Math.abs(out.azimuth - Math.PI / 2)).toBeGreaterThan(0.2);
    expect(Math.abs(out.azimuth - Math.PI / 2)).toBeLessThan(Math.PI / 2 + 1e-6);
    expect(out.elevation).toBeCloseTo(UP);
    // A clear view stays as it is.
    expect(clearView(0, 0.9, 0, 6.5, { azimuth: -Math.PI / 2, elevation: UP }, WALL, TOP, out)).toBe(true);
    expect(out.azimuth).toBeCloseTo(-Math.PI / 2);
  });

  it('climbs to look down into a nook no turn can see into', () => {
    // A tight nook, walls 0.6 m away on every side.
    const nook = [{ x: 0.7, z: 0, hx: 0.1, hz: 1 }, { x: -0.7, z: 0, hx: 0.1, hz: 1 }, { x: 0, z: 0.7, hx: 1, hz: 0.1 }, { x: 0, z: -0.7, hx: 1, hz: 0.1 }];
    const out: ViewAngle = { azimuth: 0, elevation: 0 };
    expect(clearView(0, 0.9, 0, 6.5, { azimuth: 0.3, elevation: UP }, nook, TOP, out)).toBe(true);
    expect(out.elevation).toBeGreaterThan(UP + 0.1);
  });

  it('finds an orbit round the aim that sees every framed player', () => {
    // One player just past the wall at (1.6, 0), one tucked in front of it at (-0.3, 0): from +x the wall hides the second.
    const heads = [{ x: 1.6, y: 1.05, z: 0 }, { x: -0.3, y: 1.05, z: 0 }];
    const aim = { x: 0, y: 0, z: 0 };
    const from = { azimuth: Math.PI / 2, elevation: (40 * Math.PI) / 180 };
    const eye = { x: Math.cos(from.elevation) * 14, y: Math.sin(from.elevation) * 14, z: 0 };
    expect(anyBlocked(heads, 2, eye.x, eye.y, eye.z, WALL, TOP)).toBe(true);
    const out: ViewAngle = { azimuth: 0, elevation: 0 };
    expect(clearViewOf(heads, 2, aim, 14, from, WALL, TOP, out)).toBe(true);
    const flat = Math.cos(out.elevation) * 14;
    expect(anyBlocked(heads, 2, Math.sin(out.azimuth) * flat, Math.sin(out.elevation) * 14, Math.cos(out.azimuth) * flat, WALL, TOP)).toBe(false);
  });

  it('swings only after a player has stayed hidden a moment', () => {
    const dodge = new WallDodge();
    const heads = [{ x: 1.6, y: 1.05, z: 0 }, { x: -0.3, y: 1.05, z: 0 }];
    const view = { azimuth: Math.PI / 2, elevation: (40 * Math.PI) / 180 };
    const eye = { x: Math.cos(view.elevation) * 14, y: Math.sin(view.elevation) * 14, z: 0 };
    expect(dodge.update(view, eye, heads, 2, { x: 0, y: 0, z: 0 }, 14, view.elevation, WALL, 0.1)).toBe(false);
    expect(dodge.update(view, eye, heads, 2, { x: 0, y: 0, z: 0 }, 14, view.elevation, WALL, 0.3)).toBe(true);
    expect(view.azimuth).not.toBeCloseTo(Math.PI / 2);
  });
});
