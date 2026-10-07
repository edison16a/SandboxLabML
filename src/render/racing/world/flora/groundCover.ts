import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';
import { valueNoise } from '../noise';
import { clump } from './broadleafGeometry';
import { MeshBuilder } from './meshBuilder';

/** A low shrub: two or three leafy lumps huddled together, about a meter tall at scale 1. */
export function shrubGeometry(variant: number): THREE.BufferGeometry {
  const rng = new Rng(401 + variant * 3);
  const b = new MeshBuilder();
  const base = new THREE.IcosahedronGeometry(1, variant ? 1 : 0);
  const center = new THREE.Vector3(0, 0.3, 0);
  for (let k = 0; k < (variant ? 2 : 3); k++) {
    const a = rng.range(0, Math.PI * 2);
    const at = new THREE.Vector3(Math.cos(a) * 0.45, rng.range(0.3, 0.6), Math.sin(a) * 0.45);
    clump(b, base, at, rng.range(0.55, 0.85), center, 90 + k + variant * 5);
  }
  base.dispose();
  return b.build();
}

const SAND = new THREE.Color('#b3a086');
const SAND_DARK = new THREE.Color('#786956');
const SAND_PALE = new THREE.Color('#d5c8ab');

/**
 * A weathered sandstone boulder: a lumpy, squat, faceted stone with a flat
 * base, darker at the foot where dirt and shade collect and banded by
 * layers of rock. Flat shaded, so every facet catches the sun its own way.
 */
export function rockGeometry(variant: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const seed = 500 + variant * 9;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const bump = 0.72 + valueNoise(x * 1.7 + 3, z * 1.7 + y * 1.3, seed) * 0.5;
    const sx = variant ? 1.25 : 1;
    const ny = Math.max(-0.25, y * (variant ? 0.55 : 0.68) * bump);
    pos.setXYZ(i, x * bump * sx, ny + 0.25, z * bump);
    const band = Math.sin(ny * 9 + valueNoise(x * 3, z * 3, seed + 1) * 2) * 0.5 + 0.5;
    c.copy(SAND_DARK).lerp(SAND, Math.min(1, (ny + 0.3) * 1.6)).lerp(SAND_PALE, band * 0.35 * Math.max(0, ny));
    c.toArray(colors, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Boulder material: flat shaded vertex colors, broken up with world space
 * grain and darker cracks from the shared noise, so no two rocks share a
 * pattern and big ones do not look like plain painted polygons.
 */
export function createRockMaterial(noise: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true, envMapIntensity: 0.8 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: noise };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRock;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvRock = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;\n#else\nvRock = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vRock;')
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          'vec4 g1 = texture2D( uDetail, vRock.xz * 0.9 + vRock.y * 0.3 );',
          'vec4 g2 = texture2D( uDetail, vec2( vRock.x + vRock.z, vRock.y * 3.0 ) * 0.12 );',
          'diffuseColor.rgb *= ( 0.8 + g1.r * 0.35 ) * ( 0.86 + g2.g * 0.28 );',
          'diffuseColor.rgb *= 1.0 - 0.35 * smoothstep( 0.03, 0.0, abs( g2.b - 0.5 ) );',
        ].join('\n'),
      );
  };
  m.customProgramCacheKey = () => 'racing-rock';
  return m;
}
