import * as THREE from 'three';
import { HS_COLORS } from '../palette';
import { EMBLEM_GLSL, EMBLEM_SHARE, EMBLEM_SIZE } from './emblem';

/** Side of one floor tile, m. 25 tiles span the 20 m room, so a crate covers about a tile and a quarter. */
export const TILE_METERS = 0.8;
/** Full width of a grout line, m. */
const GROUT = 0.022;
/** The rounded edge of a tile: how far in from the grout it starts, and how far it drops, m. */
const BEVEL = 0.035;
const BEVEL_DROP = 0.004;
/** How dark the grout is against the tiles: a thin crisp line, not a heavy grid. */
const GROUT_SHADE = 0.6;

const PARS = /* glsl */ `
varying vec2 vTile;
float hsHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
${EMBLEM_GLSL}
`;

/**
 * The tile pattern. Grout lines are box filtered over the pixel footprint
 * (after Inigo Quilez's filtered grid), so they stay crisp up close and
 * fade to their true average far away, with no shimmer on the grid. Each
 * tile gets its own faint tone and gloss; a few carry the engraved mark.
 */
const PATTERN = /* glsl */ `
vec2 tp = vTile / ${TILE_METERS.toFixed(4)} + 0.5;
vec2 cell = floor(tp);
vec2 f = tp - cell;
vec2 fw = max(fwidth(tp), vec2(1e-5));
float pxM = max(fw.x, fw.y) * ${TILE_METERS.toFixed(4)};
const float N = ${(TILE_METERS / GROUT).toFixed(3)};
vec2 q = tp + 0.5 / N;
vec2 qa = q + 0.5 * fw;
vec2 qb = q - 0.5 * fw;
vec2 line = clamp((floor(qa) + min(fract(qa) * N, 1.0) - floor(qb) - min(fract(qb) * N, 1.0)) / (N * fw), 0.0, 1.0);
float tileCover = (1.0 - line.x) * (1.0 - line.y);
float tileTone = 1.0 + (hsHash(cell) - 0.5) * 0.045;
float engrave = 0.0;
float emblemH = 0.0;
if (hsHash(cell + 17.31) < ${EMBLEM_SHARE.toFixed(3)}) {
  float unit = ${((TILE_METERS * EMBLEM_SIZE) / 28).toFixed(5)};
  float d = hsEmblem((f - 0.5) * ${(28 / EMBLEM_SIZE).toFixed(3)} + 14.0);
  float aa = max(pxM / unit, 0.2);
  engrave = 1.0 - smoothstep(0.5 - aa, 0.5 + aa, abs(d));
  emblemH = -0.0016 * (1.0 - smoothstep(0.0, 1.1, abs(d)));
}
diffuseColor.rgb *= mix(vec3(${GROUT_SHADE.toFixed(3)}), vec3(tileTone * (1.0 - 0.1 * engrave)), tileCover);
`;

/** Glossy tiles, rougher grout and a slightly duller engraving: the satin sheen comes from the variation. */
const ROUGHNESS = /* glsl */ `
roughnessFactor = mix(0.92, roughnessFactor * (0.86 + 0.28 * hsHash(cell + 3.7)) + 0.14 * engrave, tileCover);
`;

/**
 * The rounded tile edges as an analytic slope, so every tile edge catches
 * the light on one side and darkens on the other, plus the engraving's
 * groove from screen derivatives. Both fade out once a pixel covers more
 * than the bevel, where they could only shimmer.
 */
const NORMAL = /* glsl */ `
{
  vec2 edge = min(f, 1.0 - f) * ${TILE_METERS.toFixed(4)};
  vec2 t = clamp((edge - ${(GROUT / 2).toFixed(4)}) / ${BEVEL.toFixed(4)}, 0.0, 1.0);
  float near = 1.0 - smoothstep(${(BEVEL * 0.2).toFixed(4)}, ${BEVEL.toFixed(4)}, pxM);
  vec2 g = -sign(f - 0.5) * (1.0 - t) * ${((2 * BEVEL_DROP) / BEVEL).toFixed(4)} * near;
  if (emblemH != 0.0 && near > 0.0) {
    vec2 tx = dFdx(vTile);
    vec2 ty = dFdy(vTile);
    float det = tx.x * ty.y - tx.y * ty.x;
    if (abs(det) > 1e-12) g += near * vec2(ty.y * dFdx(emblemH) - tx.y * dFdy(emblemH), tx.x * dFdy(emblemH) - ty.x * dFdx(emblemH)) / det;
  }
  normal = normalize((viewMatrix * vec4(normalize(vec3(-g.x, 1.0, -g.y)), 0.0)).xyz);
}
`;

/**
 * The floor of every room: light grey square tiles in a crisp grid with a
 * soft satin sheen, generated in the shader from the floor position, so
 * there is no texture to blur or tile and it works on the instanced grid
 * floors too (each arena gets the same pattern, aligned to its walls).
 * Expects a horizontal floor whose local x and z are the room's.
 */
export function tileFloorMaterial(params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: HS_COLORS.floor, roughness: 0.34, metalness: 0, envMapIntensity: 0.55, ...params });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTile;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTile = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${PATTERN}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${ROUGHNESS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${NORMAL}`);
  };
  m.customProgramCacheKey = () => 'hs-tile-floor';
  return m;
}
