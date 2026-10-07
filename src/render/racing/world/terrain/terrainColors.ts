import * as THREE from 'three';
import { fbm, smoothstep } from '../noise';
import { distanceAt } from '../trackField';
import { flatRadius, rockiness, type TerrainShape } from './terrainHeight';

/**
 * Ground colors, picked from late afternoon light on dry hill country:
 * golden dry grass, olive patches where water collects, bare dirt, warm
 * sandstone, and a greener watered verge along the circuit.
 */
const C = {
  dry: new THREE.Color('#c4a463'),
  dryDark: new THREE.Color('#957a44'),
  olive: new THREE.Color('#7f8742'),
  green: new THREE.Color('#5f7234'),
  dirt: new THREE.Color('#a5805a'),
  rock: new THREE.Color('#bd9369'),
  rockDark: new THREE.Color('#8d6a4d'),
  verge: new THREE.Color('#939549'),
  vergeDry: new THREE.Color('#b6a35d'),
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
  const c = new THREE.Color();
  const tmp = new THREE.Color();
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
    c.copy(C.dryDark).lerp(C.dry, smoothstep(0.25, 0.75, grain));
    // Olive and green collect in the low ground, where water would.
    const wet = smoothstep(0.52, 0.72, patch) * (1 - smoothstep(4, 30, y));
    c.lerp(tmp.copy(C.olive).lerp(C.green, smoothstep(0.62, 0.85, patch)), wet * 0.85);
    const dirt = smoothstep(0.6, 0.78, fbm(x / 34, z / 34, seed + 19, 2)) * 0.7 + smoothstep(0.18, 0.32, slope) * 0.4;
    c.lerp(C.dirt, Math.min(0.8, dirt));
    const verge = 1 - smoothstep(flat - 4, flat + 26, d);
    c.lerp(tmp.copy(C.verge).lerp(C.vergeDry, grain * 0.6), verge);
    const rock = Math.min(1, rockiness(shape, x, z) * 0.9 + smoothstep(0.3, 0.55, slope)) * (1 - verge);
    c.lerp(tmp.copy(C.rockDark).lerp(C.rock, grain), rock);
    // Far mountains: ridges go bare, a little darker with scrub.
    const high = smoothstep(60, 260, y);
    c.lerp(tmp.copy(C.rockDark).lerp(C.olive, patch * 0.6), high * 0.55);
    color[i * 3] = c.r;
    color[i * 3 + 1] = c.g;
    color[i * 3 + 2] = c.b;
    surface[i * 2] = rock;
    surface[i * 2 + 1] = verge;
  }
  return { color, surface };
}
