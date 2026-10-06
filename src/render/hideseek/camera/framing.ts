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

/** Elevation of the overview and arena shots: steep enough to see into every room past its walls, low enough to read heights. */
const ELEVATION = (60 * Math.PI) / 180;
const TOP = Math.PI / 2 - 1e-3;
/** Wall height, m: the tops of the far walls must fit in the shot too. */
const WALL = 2.5;
/**
 * Share of the screen the shot may fill. The HUD sits along the top and
 * bottom edges, so the shot keeps clear of those and may run wider.
 */
const FILL = { h: 0.94, v: 0.84 };

/**
 * Smallest camera distance at which a floor rectangle, walls included,
 * fits the view from the given elevation. Exact for a perspective camera:
 * each corner gives a bound from its screen x and one from its screen y,
 * and near corners, which look bigger, decide it.
 */
export function fitDistance(width: number, depth: number, fovDeg: number, aspect: number, elevation = ELEVATION): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360) * FILL.v;
  const tanH = Math.tan((fovDeg * Math.PI) / 360) * aspect * FILL.h;
  const dy = Math.sin(elevation);
  const dz = Math.cos(elevation);
  let best = 0;
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      for (const y of [0, WALL]) {
        const along = y * dy + z * dz;
        const up = y * dz - z * dy;
        best = Math.max(best, Math.abs(x) / tanH + along, Math.abs(up) / tanV + along);
      }
    }
  }
  return best;
}

function orbitShot(cx: number, cz: number, distance: number, top: boolean): Shot {
  if (top) return { px: cx, py: distance, pz: cz + 0.01, tx: cx, ty: 0, tz: cz };
  return { px: cx, py: Math.sin(ELEVATION) * distance, pz: cz + Math.cos(ELEVATION) * distance, tx: cx, ty: 0, tz: cz };
}

/** The whole grid. */
export function overviewShot(lattice: Lattice, fovDeg: number, aspect: number, top: boolean): Shot {
  return orbitShot(0, 0, fitDistance(lattice.width, lattice.depth, fovDeg, aspect, top ? TOP : ELEVATION), top);
}

/** One arena, framed with a little room around its walls. */
export function arenaShot(cx: number, cz: number, span: number, fovDeg: number, aspect: number, top: boolean): Shot {
  return orbitShot(cx, cz, fitDistance(span + 2, span + 2, fovDeg, aspect, top ? TOP : ELEVATION), top);
}

/** Smooth start and stop, so a 500 ms fly never jerks. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
