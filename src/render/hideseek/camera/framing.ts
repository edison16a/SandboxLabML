import type { Lattice } from '../layout/gridLattice';

/** Where the camera sits and what it looks at. */
export interface Shot {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
}

/** Elevation of the overview shots: steep enough to see into every room past its walls, low enough to read heights. */
const ELEVATION = (60 * Math.PI) / 180;
/** The close shot: a three quarter view from 50 degrees up, turned a little off the room's axis so walls and crates read as solid. */
export const CLOSE_ELEVATION = (50 * Math.PI) / 180;
export const CLOSE_AZIMUTH = (24 * Math.PI) / 180;
const TOP = Math.PI / 2 - 1e-3;
/** Wall height, m: the tops of the far walls must fit in the shot too. */
const WALL = 2.5;
/**
 * Share of the screen the shot may fill. The HUD sits along the top and
 * bottom edges, so the shot keeps clear of those and may run wider.
 */
const FILL = { h: 0.94, v: 0.84 };
/** The close shot fills the viewport edge to edge and lets the near wall run off it a little. */
const CLOSE_FILL = { h: 1.32, v: 1.26 };

/**
 * Smallest camera distance at which a floor rectangle, walls included,
 * fits the view from the given elevation, seen from `azimuth` rad round
 * from the +z side. Exact for a perspective camera: each corner gives a
 * bound from its screen x and one from its screen y, and near corners,
 * which look bigger, decide it.
 */
export function fitDistance(width: number, depth: number, fovDeg: number, aspect: number, elevation = ELEVATION, azimuth = 0, fill = FILL): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360) * fill.v;
  const tanH = Math.tan((fovDeg * Math.PI) / 360) * aspect * fill.h;
  const dy = Math.sin(elevation);
  const dz = Math.cos(elevation);
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  let best = 0;
  for (const cx of [-width / 2, width / 2]) {
    for (const cz of [-depth / 2, depth / 2]) {
      // The corner in the camera's own frame: x across the screen, z toward the camera.
      const x = cx * ca - cz * sa;
      const z = cx * sa + cz * ca;
      for (const y of [0, WALL]) {
        const along = y * dy + z * dz;
        const up = y * dz - z * dy;
        best = Math.max(best, Math.abs(x) / tanH + along, Math.abs(up) / tanV + along);
      }
    }
  }
  return best;
}

/** A camera `distance` m from (cx, cz) at `elevation`, `azimuth` rad round from the +z side toward +x. */
export function orbitShot(cx: number, cz: number, distance: number, elevation: number, azimuth = 0, ty = 0): Shot {
  const flat = Math.cos(elevation) * distance;
  return { px: cx + Math.sin(azimuth) * flat, py: ty + Math.sin(elevation) * distance, pz: cz + Math.cos(azimuth) * flat, tx: cx, ty, tz: cz };
}

/** The whole grid, square on, from the overview elevation or a little lower for the close view. */
export function overviewShot(lattice: Lattice, fovDeg: number, aspect: number, top: boolean, close = false): Shot {
  const elevation = top ? TOP : close ? CLOSE_ELEVATION : ELEVATION;
  return orbitShot(0, 0, fitDistance(lattice.width, lattice.depth, fovDeg, aspect, elevation), elevation);
}

/** One arena, framed with a little room around its walls. */
export function arenaShot(cx: number, cz: number, span: number, fovDeg: number, aspect: number, top: boolean): Shot {
  const elevation = top ? TOP : ELEVATION;
  return orbitShot(cx, cz, fitDistance(span + 2, span + 2, fovDeg, aspect, elevation), elevation);
}

/** One arena close up: the three quarter view that fills the viewport with the room. */
export function closeShot(cx: number, cz: number, span: number, fovDeg: number, aspect: number): Shot {
  return orbitShot(cx, cz, fitDistance(span, span, fovDeg, aspect, CLOSE_ELEVATION, CLOSE_AZIMUTH, CLOSE_FILL), CLOSE_ELEVATION, CLOSE_AZIMUTH);
}

/** Smooth start and stop, so a 500 ms fly never jerks. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
