import type * as THREE from 'three';
import { hash, packNormal, pixelTexture } from './pixels';

/** Tows across one tile. Four makes one full repeat of a 2x2 twill. */
const TOWS = 8;

export interface CarbonMaps {
  color: THREE.DataTexture;
  normal: THREE.DataTexture;
  /** Fiber direction per pixel, for three's anisotropic highlights. */
  anisotropy: THREE.DataTexture;
}

/**
 * Which way the tow on top runs at a pixel, in a 2x2 twill: each tow goes
 * over two and under two, shifted by one per row, which draws the diagonal
 * ribs carbon fiber is known for. Returns 0 for tows along U, 1 along V,
 * and how far across the tow the pixel sits (0 to 1).
 */
function twill(x: number, y: number, size: number): { along: 0 | 1; across: number; run: number } {
  const t = size / TOWS;
  const i = Math.floor(x / t);
  const j = Math.floor(y / t);
  const vertical = (((i + j) % 4) + 4) % 4 < 2;
  return vertical ? { along: 1, across: (x % t) / t, run: (y % (2 * t)) / (2 * t) } : { along: 0, across: (y % t) / t, run: (x % (2 * t)) / (2 * t) };
}

/**
 * Procedural carbon fiber: a color map where each tow is a little brighter
 * along its crown and the two directions differ in tone, a normal map that
 * rounds every tow and dips it where it passes under its neighbor, and a
 * direction map so the highlight streaks along the fibers.
 */
export function carbonMaps(size: number): CarbonMaps {
  const color = pixelTexture(size, true, (x, y, out) => {
    const w = twill(x, y, size);
    const crown = Math.sin(w.across * Math.PI);
    const fiber = hash(w.along ? x : y, 7) * 0.5 + hash(x, y, 9) * 0.5;
    const v = 10 + crown * 12 + fiber * 6 + (w.along ? 5 : 0);
    out[0] = v;
    out[1] = v + 1;
    out[2] = v + 3;
  });
  const normal = pixelTexture(size, false, (x, y, out) => {
    const w = twill(x, y, size);
    const side = -Math.cos(w.across * Math.PI) * 0.45;
    const dip = Math.sin(w.run * Math.PI * 2) * 0.12;
    if (w.along) packNormal(side, dip, out);
    else packNormal(dip, side, out);
  });
  const anisotropy = pixelTexture(size, false, (x, y, out) => {
    const w = twill(x, y, size);
    out[0] = w.along ? 128 : 255;
    out[1] = w.along ? 255 : 128;
    out[2] = 255;
  });
  return { color, normal, anisotropy };
}
