import * as THREE from 'three';
import { withHaze } from '../atmosphere';

/**
 * Close up detail for the ground, layered on the per vertex colors: grass
 * grain and clumps at two scales, combed blade streaks near the camera,
 * sandstone strata on rock, a small relief that bends the light, and a
 * gentle fade of all of it with distance so the far hills do not shimmer.
 * Lighting, shadows and haze stay three's own.
 */
const DETAIL = /* glsl */ `
vec3 terrainDetail(vec3 base, vec3 wp, vec2 surf, float dist) {
  vec4 n1 = texture2D(uDetail, wp.xz * 0.21);
  vec4 n2 = texture2D(uDetail, wp.xz * 0.031 + 0.37);
  vec4 n3 = texture2D(uDetail, wp.xz * 1.3);
  float fade = 1.0 - smoothstep(60.0, 420.0, dist);
  // Grass: clumps of lighter and darker blades, a little greener in the shade of each clump.
  float grass = (n1.r - 0.5) * 0.5 + (n2.g - 0.5) * 0.55 + (n3.r - 0.5) * 0.3 * (1.0 - smoothstep(10.0, 60.0, dist));
  vec3 g = base * (1.0 + grass * fade);
  g = mix(g, g * vec3(0.86, 0.97, 0.78), smoothstep(0.55, 0.85, n2.g) * 0.5 * fade);
  // The verge is mown: soft stripes along the grain and a finer, even texture.
  float mow = smoothstep(0.3, 0.7, abs(fract(dot(wp.xz, vec2(0.7071)) * 0.09) - 0.5) * 2.0);
  g *= mix(1.0, 0.88 + 0.2 * mow, surf.y * fade);
  // Rock: layered bands of sandstone with cracks.
  float strata = sin(wp.y * 2.3 + n2.g * 6.0) * 0.5 + 0.5;
  float crack = smoothstep(0.22, 0.05, abs(n1.b - 0.5));
  vec3 r = base * (0.86 + strata * 0.2 + (n3.r - 0.5) * 0.25) * (1.0 - crack * 0.3 * fade);
  // Up close the grass shows its blades: streaks of light and shade, each patch combed its own way.
  float comb = n2.g * 6.28;
  vec2 bladeUv = mat2(cos(comb), sin(comb), -sin(comb), cos(comb)) * wp.xz * vec2(3.4, 0.55);
  float blades = texture2D(uDetail, bladeUv).r;
  g *= 1.0 + (blades - 0.5) * 0.42 * (1.0 - smoothstep(6.0, 34.0, dist)) * (1.0 - surf.x);
  // Far away the fine detail is gone; broad patches of scrub and bare ground keep distant slopes from looking painted flat.
  vec4 n4 = texture2D(uDetail, wp.xz * 0.0045 + 0.11);
  float far = smoothstep(250.0, 900.0, dist);
  return mix(g, r, surf.x) * (1.0 + (n4.g - 0.5) * 0.5 * far + (n2.r - 0.5) * 0.25 * far);
}

/** Small scale relief: grass clumps and tussocks, or the ledges of the rock. Feeds the bump below. */
float terrainRelief(vec3 wp, vec2 surf) {
  float tussock = texture2D(uDetail, wp.xz * 0.8).r * 0.6 + texture2D(uDetail, wp.xz * 0.21).g * 0.4;
  float ledges = sin(wp.y * 2.3 + texture2D(uDetail, wp.xz * 0.031 + 0.37).g * 6.0) * 0.5 + 0.5;
  return mix(tussock * 0.6, ledges * 1.4 + tussock * 0.3, surf.x);
}

/** Bends the shading normal by the slope of a height, from screen space derivatives, so no tangents are needed. */
vec3 terrainBump(vec3 surf, vec3 n, float h, float k) {
  vec3 sx = normalize(dFdx(surf));
  vec3 sy = normalize(dFdy(surf));
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * k * r1 + dFdy(h) * k * r2);
  return normalize(abs(det) * n - grad);
}
`;

/**
 * The ground material. High and Medium get the detail shader on a standard
 * material; Low keeps the vertex colors on a Lambert material, much cheaper
 * per pixel, since the ground fills most of the screen.
 */
export function createTerrainMaterial(detail: boolean, noise: THREE.Texture): THREE.Material {
  if (!detail) return withHaze(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.9 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: noise };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 surface;\nvarying vec2 vSurface;\nvarying vec3 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = surface;\nvGround = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uDetail;\nvarying vec2 vSurface;\nvarying vec3 vGround;\n${DETAIL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = terrainDetail( diffuseColor.rgb, vGround, vSurface, length( vViewPosition ) );')
      // The low sun rakes across the relief, so tussocks and ledges catch light close to the camera; it fades out before it could shimmer.
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = terrainBump( - vViewPosition, normal, terrainRelief( vGround, vSurface ), 0.9 * ( 1.0 - smoothstep( 15.0, 90.0, length( vViewPosition ) ) ) );');
  };
  m.customProgramCacheKey = () => 'racing-terrain';
  return withHaze(m);
}
