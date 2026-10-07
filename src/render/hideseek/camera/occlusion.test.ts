import { describe, expect, it } from 'vitest';
import { clearView, sightBlocked, type ViewAngle } from './occlusion';

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
});
