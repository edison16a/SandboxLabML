/**
 * Seeded 2D noise for the racing world: terrain heights, colors and where
 * trees and rocks go. Pure math with no DOM, so the same track always grows
 * the same landscape and tests can check it in Node.
 */

/** Integer lattice hash to [0, 1). Cheap, and good enough for landscape noise. */
export function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1], with quintic easing so slopes have no creases at cell edges. */
export function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** Fractal noise: octaves of value noise, each twice as fine and half as strong. Returns about [0, 1]. */
export function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    // Rotating each octave a little hides the lattice grid.
    const rx = x * f * 0.8 - z * f * 0.6;
    const rz = x * f * 0.6 + z * f * 0.8;
    sum += valueNoise(rx, rz, seed + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/**
 * Ridged noise: sharp crests where plain noise crosses its middle. It reads
 * as ridgelines and rock spines, which is what eroded sandstone hills look like.
 */
export function ridged(x: number, z: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  let weight = 1;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise(x * f, z * f, seed + o * 17) * 2 - 1);
    const v = n * n * weight;
    weight = Math.min(1, v * 1.6);
    sum += v * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return sum / norm;
}

/** Hermite step between two edges, like GLSL smoothstep. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
