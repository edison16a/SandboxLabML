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
export const CLOSE_AZIMUTH = (18 * Math.PI) / 180;
const TOP = Math.PI / 2 - 1e-3;
/** Wall height, m: the tops of the far walls must fit in the shot too. */
const WALL = 2.5;
/**
 * Where a shot may put the room on screen, as shares of the half screen:
 * across, and above and below the middle. Less than 1 keeps clear of the
 * HUD along the edges.
 */
export interface ScreenWindow {
  h: number;
  up: number;
  down: number;
}

/** The grid overviews and the top down shot keep clear of the HUD along the top and bottom edges, and may run wider. */
const FILL: ScreenWindow = { h: 0.94, up: 0.84, down: 0.84 };
/**
 * One room seen at an angle keeps its whole floor above the picture in
 * picture strip along the bottom, so no agent hides under it. The top row
 * of HUD chips may sit over the far wall, which can take it.
 */
const ROOM_FILL: ScreenWindow = { h: 0.94, up: 0.9, down: 0.6 };
/** The close shot also fills the width. */
const CLOSE_FILL: ScreenWindow = { h: 0.99, up: 0.95, down: 0.6 };

/**
 * Smallest camera distance at which a floor rectangle, walls included,
 * fits the window from the given elevation, seen from `azimuth` rad round
 * from the +z side, with the aim moved `shift` m toward the camera. Exact
 * for a perspective camera: each corner gives a bound from its screen x
 * and one from its screen y, and near corners, which look bigger, decide it.
 */
function fitAt(width: number, depth: number, fovDeg: number, aspect: number, elevation: number, azimuth: number, fill: ScreenWindow, shift: number): number {
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tan * aspect * fill.h;
  const dy = Math.sin(elevation);
  const dz = Math.cos(elevation);
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  let best = 0;
  for (const cx of [-width / 2, width / 2]) {
    for (const cz of [-depth / 2, depth / 2]) {
      // The corner in the camera's own frame: x across the screen, z toward the camera.
      const x = cx * ca - cz * sa;
      const z = cx * sa + cz * ca - shift;
      for (const y of [0, WALL]) {
        const along = y * dy + z * dz;
        const up = y * dz - z * dy;
        best = Math.max(best, Math.abs(x) / tanH + along, Math.abs(up) / (tan * (up >= 0 ? fill.up : fill.down)) + along);
      }
    }
  }
  return best;
}

/** Smallest camera distance at which a floor rectangle, walls included, fits the view, aimed at its middle. */
export function fitDistance(width: number, depth: number, fovDeg: number, aspect: number, elevation = ELEVATION, azimuth = 0, fill = FILL): number {
  return fitAt(width, depth, fovDeg, aspect, elevation, azimuth, fill, 0);
}

/**
 * The closest framing of a floor rectangle in a window that need not be
 * centered: how far the camera stands and how far its aim moves from the
 * middle toward the camera (negative away), m. The distance only grows as
 * the aim leaves its best place, so a ternary search finds it.
 */
export function fitWindow(width: number, depth: number, fovDeg: number, aspect: number, elevation: number, azimuth: number, fill: ScreenWindow): { distance: number; shift: number } {
  let lo = -Math.max(width, depth) / 2;
  let hi = -lo;
  for (let i = 0; i < 60; i++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    if (fitAt(width, depth, fovDeg, aspect, elevation, azimuth, fill, a) < fitAt(width, depth, fovDeg, aspect, elevation, azimuth, fill, b)) hi = b;
    else lo = a;
  }
  const shift = (lo + hi) / 2;
  return { distance: fitAt(width, depth, fovDeg, aspect, elevation, azimuth, fill, shift), shift };
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

/** One arena, framed with a little room around its walls: square on, or straight down. */
export function arenaShot(cx: number, cz: number, span: number, fovDeg: number, aspect: number, top: boolean): Shot {
  if (top) return orbitShot(cx, cz, fitDistance(span + 2, span + 2, fovDeg, aspect, TOP), TOP);
  const fit = fitWindow(span + 2, span + 2, fovDeg, aspect, ELEVATION, 0, ROOM_FILL);
  return orbitShot(cx, cz + fit.shift, fit.distance, ELEVATION);
}

/** One arena close up: the three quarter view that fills the viewport with the room, its floor clear of the bottom HUD. */
export function closeShot(cx: number, cz: number, span: number, fovDeg: number, aspect: number): Shot {
  const fit = fitWindow(span, span, fovDeg, aspect, CLOSE_ELEVATION, CLOSE_AZIMUTH, CLOSE_FILL);
  return orbitShot(cx + Math.sin(CLOSE_AZIMUTH) * fit.shift, cz + Math.cos(CLOSE_AZIMUTH) * fit.shift, fit.distance, CLOSE_ELEVATION, CLOSE_AZIMUTH);
}

/** A scene a view is fit to: its center on the floor and its size (the close shot's distance there). */
export interface SceneFrame {
  x: number;
  z: number;
  size: number;
}

/**
 * Carries a hand placed view from one scene to another: the same angle,
 * the aim moved with the scene's center and every distance scaled to the
 * new scene's size, so a view of one room becomes the same view of the
 * whole grid and back. `p` is the camera, `t` the point it orbits.
 */
export function carryShot(p: { x: number; y: number; z: number }, t: { x: number; y: number; z: number }, from: SceneFrame, to: SceneFrame): Shot {
  const k = to.size / from.size;
  const tx = to.x + (t.x - from.x) * k;
  const ty = t.y * k;
  const tz = to.z + (t.z - from.z) * k;
  return { px: tx + (p.x - t.x) * k, py: ty + (p.y - t.y) * k, pz: tz + (p.z - t.z) * k, tx, ty, tz };
}

/** Smooth start and stop, so a 500 ms fly never jerks. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
