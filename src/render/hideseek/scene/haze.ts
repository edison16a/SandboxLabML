import { BACKDROP_HALF, CITY_MARGIN, CITY_REACH } from './backdropBlocks';

/**
 * Limits of the haze, as depths from the camera in m. Fog in three counts
 * depth from the camera, and the camera here works anywhere from a few
 * meters out to several hundred. Far out these limits hold; close in, the
 * haze comes nearer so the city never ends in a hard edge.
 */
export const HAZE = { near: 160, far: 620, ramp: 110 };

/**
 * Distance from (x, z) on the floor to the nearest outer edge of the
 * backdrop city, m. The city is the band of blocks round the clear ground
 * of arenas spanning ±hx by ±hz, cut to the square the blocks come from.
 */
export function cityEdgeFrom(x: number, z: number, hx: number, hz: number): number {
  const ex = Math.min(hx + CITY_MARGIN + CITY_REACH, BACKDROP_HALF) - Math.abs(x);
  const ez = Math.min(hz + CITY_MARGIN + CITY_REACH, BACKDROP_HALF) - Math.abs(z);
  return Math.max(0, Math.min(ex, ez));
}

/**
 * The haze for a camera `distance` m from the point it orbits, which is
 * `edge` m from the end of the city. The haze is full where the city ends
 * (or at the far limit, if that comes first) and fades in over the ramp
 * before it, so the last blocks and the bare ground beyond melt into the
 * sky from any orbit.
 */
export function hazeRange(distance: number, edge: number, out: { near: number; far: number }): { near: number; far: number } {
  out.far = Math.min(HAZE.far, distance + edge);
  out.near = Math.max(0, Math.min(HAZE.near, out.far - HAZE.ramp));
  return out;
}

/**
 * Far clip plane for a camera `distance` m from its target. It always lies
 * past the end of the haze: ground cut off before that would show as a
 * hard line against the sky.
 */
export function farPlane(distance: number): number {
  return Math.max(HAZE.far + 80, distance * 5);
}
