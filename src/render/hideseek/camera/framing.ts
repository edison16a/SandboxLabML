import type { Lattice } from '../layout/gridLattice';
import { ELEVATION, fitDistance, fitWindow, type ScreenWindow } from './fit';

/** Where the camera sits and what it looks at. */
export interface Shot {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
}

/** The close shot: a three quarter view from 50 degrees up, turned a little off the room's axis so walls and crates read as solid. */
export const CLOSE_ELEVATION = (50 * Math.PI) / 180;
export const CLOSE_AZIMUTH = (18 * Math.PI) / 180;
const TOP = Math.PI / 2 - 1e-3;

/**
 * One room seen at an angle keeps its whole floor above the picture in
 * picture strip along the bottom, so no agent hides under it. The top row
 * of HUD chips may sit over the far wall, which can take it.
 */
const ROOM_FILL: ScreenWindow = { h: 0.94, up: 0.9, down: 0.6 };
/** The close shot also fills the width. */
export const CLOSE_FILL: ScreenWindow = { h: 0.99, up: 0.95, down: 0.6 };

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
