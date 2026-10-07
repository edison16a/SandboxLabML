import type { Rect } from '@/engine/hideseek/layouts/types';

/** Turns of the camera tried each way round an agent, 15 degrees apart, up to all the way round. */
const TURNS = 12;
/** Extra elevation tried in turn, rad, when no turn round the agent clears the view: a narrow corridor. */
const RAISE = [0, 0.22, 0.4];
/** Steepest a follow view climbs to see into a corridor, rad: nearly straight down. */
const STEEPEST = 1.45;

/**
 * Whether a wall stands between a point on an agent (a) and the camera
 * (c), in the arena's own floor coordinates. The sight line rises toward
 * a camera above, so a wall blocks it only where the line crosses the
 * wall's footprint lower than `top`. One slab test per wall, and nothing
 * allocated.
 */
export function sightBlocked(ax: number, ay: number, az: number, cx: number, cy: number, cz: number, walls: readonly Rect[], top: number): boolean {
  const dx = cx - ax;
  const dy = cy - ay;
  const dz = cz - az;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    let t0 = 0;
    let t1 = 1;
    if (Math.abs(dx) < 1e-9) {
      if (Math.abs(ax - w.x) > w.hx) continue;
    } else {
      const a = (w.x - w.hx - ax) / dx;
      const b = (w.x + w.hx - ax) / dx;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (Math.abs(dz) < 1e-9) {
      if (Math.abs(az - w.z) > w.hz) continue;
    } else {
      const a = (w.z - w.hz - az) / dz;
      const b = (w.z + w.hz - az) / dz;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 > t1) continue;
    // The lowest point of the line over the wall: where it comes in when it climbs, where it leaves when it falls.
    if (ay + dy * (dy >= 0 ? t0 : t1) < top) return true;
  }
  return false;
}

/** A direction to look at an agent from: round from the +z side toward +x, and up from the floor, rad. */
export interface ViewAngle {
  azimuth: number;
  elevation: number;
}

/**
 * The view of the point (ax, ay, az) from `distance` m nearest to the
 * given angle that no wall blocks below `top`: the same angle if it is
 * clear, else the smallest turn round the agent, and only then a steeper
 * angle, which sees down into a corridor. Writes it to `out` and returns
 * true, or false when nothing clears.
 */
export function clearView(ax: number, ay: number, az: number, distance: number, from: ViewAngle, walls: readonly Rect[], top: number, out: ViewAngle): boolean {
  for (let r = 0; r < RAISE.length; r++) {
    const elevation = Math.min(STEEPEST, from.elevation + RAISE[r]);
    const flat = Math.cos(elevation) * distance;
    const y = ay + Math.sin(elevation) * distance;
    for (let k = 0; k <= TURNS; k++) {
      for (let side = k === 0 ? 1 : -1; side <= 1; side += 2) {
        const azimuth = from.azimuth + side * k * (Math.PI / TURNS);
        if (sightBlocked(ax, ay, az, ax + Math.sin(azimuth) * flat, y, az + Math.cos(azimuth) * flat, walls, top)) continue;
        out.azimuth = azimuth;
        out.elevation = elevation;
        return true;
      }
    }
  }
  return false;
}
