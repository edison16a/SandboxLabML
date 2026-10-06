import type * as THREE from 'three';
import { hash, packNormal, pixelTexture } from './pixels';

/** Tows across one tile. Four makes one full repeat of a 2x2 twill. */
const TOWS = 8;

/** The weave at one texel. A single object is filled for every texel, so the loops do not allocate. */
const tow = { along: 0 as 0 | 1, across: 0, run: 0 };

/**
 * Which way the tow on top runs at a pixel, in a 2x2 twill: each tow goes
 * over two and under two, shifted by one per row, which draws the diagonal
 * ribs carbon fiber is known for. Gives 0 for tows along U, 1 along V,
 * and how far across the tow the pixel sits (0 to 1).
 */
function twill(x: number, y: number, size: number): typeof tow {
  const t = size / TOWS;
  const i = Math.floor(x / t);
  const j = Math.floor(y / t);
  const vertical = (((i + j) % 4) + 4) % 4 < 2;
  tow.along = vertical ? 1 : 0;
  tow.across = vertical ? (x % t) / t : (y % t) / t;
  tow.run = vertical ? (y % (2 * t)) / (2 * t) : (x % (2 * t)) / (2 * t);
  return tow;
}

/**
 * Procedural carbon fiber color: each tow is a little brighter along its
 * crown, and the two directions differ in tone. The normal and fiber maps
 * below are separate builds, so a tier that skips them never pays for them.
 */
export function carbonColor(size: number): THREE.DataTexture {
  return pixelTexture('carbon-color', size, true, (x, y, out) => {
    const w = twill(x, y, size);
    const crown = Math.sin(w.across * Math.PI);
    const fiber = hash(w.along ? x : y, 7) * 0.5 + hash(x, y, 9) * 0.5;
    const v = 10 + crown * 12 + fiber * 6 + (w.along ? 5 : 0);
    out[0] = v;
    out[1] = v + 1;
    out[2] = v + 3;
  });
}

/** Normals that round every tow and dip it where it passes under its neighbor. */
export function carbonNormal(size: number): THREE.DataTexture {
  return pixelTexture('carbon-normal', size, false, (x, y, out) => {
    const w = twill(x, y, size);
    const side = -Math.cos(w.across * Math.PI) * 0.45;
    const dip = Math.sin(w.run * Math.PI * 2) * 0.12;
    if (w.along) packNormal(side, dip, out);
    else packNormal(dip, side, out);
  });
}

/** Fiber direction per pixel, for three's anisotropic highlights, so they streak along the fibers. */
export function carbonFibers(size: number): THREE.DataTexture {
  return pixelTexture('carbon-fibers', size, false, (x, y, out) => {
    const w = twill(x, y, size);
    out[0] = w.along ? 128 : 255;
    out[1] = w.along ? 255 : 128;
    out[2] = 255;
  });
}
