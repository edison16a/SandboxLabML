/** Where the camera sits and what it looks at. */
export interface Shot {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
}

/** A camera `distance` m from (cx, cz) at `elevation`, `azimuth` rad round from the +z side toward +x. */
export function orbitShot(cx: number, cz: number, distance: number, elevation: number, azimuth = 0, ty = 0): Shot {
  const flat = Math.cos(elevation) * distance;
  return { px: cx + Math.sin(azimuth) * flat, py: ty + Math.sin(elevation) * distance, pz: cz + Math.cos(azimuth) * flat, tx: cx, ty, tz: cz };
}

/** Smooth start and stop, so a 600 ms flight never jerks. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
