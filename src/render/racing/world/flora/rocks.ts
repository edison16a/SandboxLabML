import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, valueNoise } from '../noise';

const SAND = new THREE.Color('#b59d80');
const SAND_DARK = new THREE.Color('#6f604f');
const SAND_PALE = new THREE.Color('#dacbab');
const RUST = new THREE.Color('#a8714c');

/**
 * A weathered sandstone boulder, smooth shaded: a squat, lumpy stone with a
 * flat base and the stepped ledges of its layers, darker at the foot where
 * dirt and shade collect, rust stained in bands. Variant 1 is a broad slab.
 * Vertices are shared so the shape reads as one rounded mass; the material
 * adds the fine relief. `detail` subdivides the stone, less on cheap tiers.
 */
export function rockGeometry(variant: number, detail = 3): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const g = mergeVertices(ico);
  ico.dispose();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const seed = 500 + variant * 9;
  const squash = variant ? 0.5 : 0.7;
  const wide = variant ? 1.3 : 1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Big lumps, then the ledges: each layer of rock set back a touch from the one below.
    const lump = 0.74 + fbm(x * 1.3 + 3, z * 1.3 + y * 1.1, seed, 3) * 0.5;
    const layer = y * 3.2 + valueNoise(x * 2, z * 2, seed + 3) * 0.6;
    const ledge = 1 - 0.07 * (layer - Math.floor(layer));
    const r = lump * ledge;
    const ny = Math.max(-0.22, y * squash * r);
    pos.setXYZ(i, x * r * wide, ny + 0.22, z * r);
    const band = Math.sin(ny * 11 + valueNoise(x * 3, z * 3, seed + 1) * 2.5) * 0.5 + 0.5;
    c.copy(SAND_DARK).lerp(SAND, Math.min(1, (ny + 0.25) * 1.8)).lerp(SAND_PALE, band * 0.4 * Math.max(0, ny + 0.1));
    c.lerp(RUST, Math.max(0, valueNoise(x * 1.5 + 9, y * 4, seed + 5) - 0.55) * 0.9);
    c.toArray(colors, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Relief for the boulders, worked out per pixel in world space so no two
 * rocks share it and nothing stretches: grain and pitting from the shared
 * noise sampled on three planes and blended by the surface's facing, plus
 * horizontal strata. Its slope bends the shading normal, so the surface
 * catches the low sun in fine ridges, and it darkens the cracks and lightens
 * the strata in the color.
 */
const RELIEF = /* glsl */ `
float rockHeight( vec3 p, vec3 n ) {
  vec3 w = pow( abs( n ), vec3( 4.0 ) );
  w /= w.x + w.y + w.z;
  float fine = texture2D( uDetail, p.yz * 0.9 ).r * w.x + texture2D( uDetail, p.xz * 0.9 ).r * w.y + texture2D( uDetail, p.xy * 0.9 ).r * w.z;
  float coarse = texture2D( uDetail, p.yz * 0.17 ).g * w.x + texture2D( uDetail, p.xz * 0.17 ).g * w.y + texture2D( uDetail, p.xy * 0.17 ).g * w.z;
  float strata = sin( p.y * 7.0 + coarse * 5.0 ) * 0.5 + 0.5;
  return fine * 0.45 + coarse * 0.35 + strata * 0.2;
}
vec3 rockBump( vec3 surf, vec3 n, float h, float k ) {
  vec3 sx = normalize( dFdx( surf ) );
  vec3 sy = normalize( dFdy( surf ) );
  vec3 r1 = cross( sy, n );
  vec3 r2 = cross( n, sx );
  float det = dot( sx, r1 );
  vec3 grad = sign( det ) * ( dFdx( h ) * k * r1 + dFdy( h ) * k * r2 );
  return normalize( abs( det ) * n - grad );
}
`;

/** Boulder material: vertex colors, the world space relief above, and three's lighting, shadows and haze. */
export function createRockMaterial(noise: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, envMapIntensity: 0.8 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: noise };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRock;\nvarying vec3 vRockN;')
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '#ifdef USE_INSTANCING',
          '  mat4 rockModel = modelMatrix * instanceMatrix;',
          '#else',
          '  mat4 rockModel = modelMatrix;',
          '#endif',
          'vRock = ( rockModel * vec4( transformed, 1.0 ) ).xyz;',
          'vRockN = normalize( mat3( rockModel ) * objectNormal );',
        ].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vRock;\nvarying vec3 vRockN;\n${RELIEF}`)
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          'float rockH = rockHeight( vRock, normalize( vRockN ) );',
          'float rockFade = 1.0 - smoothstep( 40.0, 160.0, length( vViewPosition ) );',
          'diffuseColor.rgb *= mix( 1.0, 0.72 + rockH * 0.55, rockFade * 0.8 + 0.2 );',
        ].join('\n'),
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = rockBump( - vViewPosition, normal, rockH, 1.6 * rockFade );');
  };
  m.customProgramCacheKey = () => 'racing-rock-relief';
  return m;
}
