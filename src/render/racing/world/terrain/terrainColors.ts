import { fbm, smoothstep } from '../noise';
import { distanceAt } from '../trackField';
import { flatRadius, rockiness, type TerrainShape } from './terrainHeight';

type Rgb = [number, number, number];

/** An sRGB hex color in linear light, as three.js stores colors, without needing three (this runs in a worker). */
function linear(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

/** out = a mixed toward b by t, in place on out. Plain arrays, so painting a million vertices builds no objects. */
function lerp(out: Rgb, a: Rgb, b: Rgb, t: number): Rgb {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/**
 * Ground colors, picked from late afternoon light on dry hill country:
 * golden dry grass, olive patches where water collects, bare dirt, warm
 * sandstone, and a greener watered verge along the circuit.
 */
const C = {
  dry: linear('#c4a463'),
  dryDark: linear('#957a44'),
  olive: linear('#7f8742'),
  green: linear('#5f7234'),
  dirt: linear('#a5805a'),
  rock: linear('#bd9369'),
  rockDark: linear('#8d6a4d'),
  verge: linear('#939549'),
  vergeDry: linear('#b6a35d'),
};

/** Per vertex albedo plus a `surface` pair (rock amount, verge amount) the shader uses for close up detail. */
export interface TerrainPaint {
  color: Float32Array;
  surface: Float32Array;
}

/**
 * Paints every vertex from its height, slope and noise. Steep faces and
 * rock spines show sandstone, hollows go green, and the shelf around the
 * road is a mown verge that fades into the wild grass.
 */
export function paintTerrain(shape: TerrainShape, position: Float32Array, normal: Float32Array): TerrainPaint {
  const n = position.length / 3;
  const color = new Float32Array(n * 3);
  const surface = new Float32Array(n * 2);
  const c: Rgb = [0, 0, 0];
  const tmp: Rgb = [0, 0, 0];
  const flat = flatRadius(shape.field);
  const seed = shape.seed;
  for (let i = 0; i < n; i++) {
    const x = position[i * 3];
    const y = position[i * 3 + 1];
    const z = position[i * 3 + 2];
    const slope = 1 - normal[i * 3 + 1];
    const d = distanceAt(shape.field, x, z);
    const grain = fbm(x / 16, z / 16, seed + 13, 2);
    const patch = fbm(x / 70, z / 70, seed + 11, 3);
    lerp(c, C.dryDark, C.dry, smoothstep(0.25, 0.75, grain));
    // Olive and green collect in the low ground, where water would.
    const wet = smoothstep(0.52, 0.72, patch) * (1 - smoothstep(4, 30, y));
    lerp(c, c, lerp(tmp, C.olive, C.green, smoothstep(0.62, 0.85, patch)), wet * 0.85);
    const dirt = smoothstep(0.6, 0.78, fbm(x / 34, z / 34, seed + 19, 2)) * 0.7 + smoothstep(0.18, 0.32, slope) * 0.4;
    lerp(c, c, C.dirt, Math.min(0.8, dirt));
    const verge = 1 - smoothstep(flat - 4, flat + 26, d);
    lerp(c, c, lerp(tmp, C.verge, C.vergeDry, grain * 0.6), verge);
    const rock = Math.min(1, rockiness(shape, x, z) * 0.9 + smoothstep(0.3, 0.55, slope)) * (1 - verge);
    lerp(c, c, lerp(tmp, C.rockDark, C.rock, grain), rock);
    // Far mountains: ridges go bare, a little darker with scrub.
    const high = smoothstep(60, 260, y);
    lerp(c, c, lerp(tmp, C.rockDark, C.olive, patch * 0.6), high * 0.55);
    color[i * 3] = c[0];
    color[i * 3 + 1] = c[1];
    color[i * 3 + 2] = c[2];
    surface[i * 2] = rock;
    surface[i * 2 + 1] = verge;
  }
  return { color, surface };
}
