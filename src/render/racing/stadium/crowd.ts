import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';
import { withHaze } from '../world/atmosphere';
import { AISLE_EVERY, FRONT, ROW_DEPTH, ROWS, rowHeight } from './grandstandGeometry';

/**
 * A spectator about 1.7 m tall when standing, seated here: torso, head and
 * two arms. A `part` attribute tells the shader which is which: 0 takes the
 * shirt color, 1 a skin tone, 2 is an arm that lifts when the crowd cheers.
 */
export function spectatorGeometry(): THREE.BufferGeometry {
  const pieces: Array<[THREE.BufferGeometry, number]> = [
    [new THREE.CylinderGeometry(0.17, 0.21, 0.62, 7).translate(0, 0.62, 0), 0],
    [new THREE.SphereGeometry(0.12, 7, 5).translate(0, 1.06, 0), 1],
    [new THREE.BoxGeometry(0.09, 0.42, 0.09).translate(-0.24, 0.66, 0), 2],
    [new THREE.BoxGeometry(0.09, 0.42, 0.09).translate(0.24, 0.66, 0), 2],
  ];
  const pos: number[] = [];
  const nrm: number[] = [];
  const part: number[] = [];
  for (const [g, p] of pieces) {
    const n = g.toNonIndexed();
    pos.push(...(n.attributes.position.array as Float32Array));
    nrm.push(...(n.attributes.normal.array as Float32Array));
    for (let i = 0; i < n.attributes.position.count; i++) part.push(p);
    g.dispose();
    n.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('part', new THREE.Float32BufferAttribute(part, 1));
  return g;
}

/** Shirt colors: lots of team blue and orange, plenty of white and dark, a few brights. */
const SHIRTS = ['#2f6fd0', '#2f6fd0', '#ff9f43', '#f2f2ef', '#f2f2ef', '#1d2430', '#c43b2f', '#e8c547', '#3f8f5a', '#8c96a6'];

/** Seat positions for one stand in its own frame, as instance matrices and shirt colors. */
export function seatCrowd(length: number, seed: number, occupancy: number): { matrices: Float32Array; colors: Float32Array; count: number } {
  const rng = new Rng(seed);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const mats: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let x = -length / 2 + 0.7; x < length / 2 - 0.5; x += 0.56) {
      // Leave the aisles empty.
      const inAisle = ((x + length / 2 - 0.4) % AISLE_EVERY) > AISLE_EVERY - 1.5;
      if (inAisle || rng.next() > occupancy) continue;
      const s = rng.range(0.92, 1.08);
      m.makeRotationY(Math.PI + rng.range(-0.25, 0.25)).scale(new THREE.Vector3(s, s, s));
      m.setPosition(x + rng.range(-0.06, 0.06), rowHeight(r), FRONT + r * ROW_DEPTH + 0.42);
      mats.push(...m.elements);
      c.set(SHIRTS[rng.int(SHIRTS.length)]).toArray(cols, cols.length);
    }
  }
  return { matrices: Float32Array.from(mats), colors: Float32Array.from(cols), count: mats.length / 16 };
}

/**
 * The crowd's material. Everyone bobs a little on their own rhythm; when
 * `uExcite` rises (a car is close) they bounce, half of them jump up and
 * arms go in the air. All in the vertex shader, so a thousand fans cost
 * one draw call and no CPU.
 */
export function createCrowdMaterial(): { material: THREE.MeshLambertMaterial; time: { value: number }; excite: { value: number } } {
  const time = { value: 0 };
  const excite = { value: 0 };
  const m = new THREE.MeshLambertMaterial({ vertexColors: false });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uExcite = excite;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float part;\nuniform float uTime;\nuniform float uExcite;\nvarying vec3 vFan;')
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vec3 root = instanceMatrix[3].xyz;',
          'float ph = fract( sin( dot( root.xz + root.y, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );',
          'float bob = sin( uTime * ( 1.6 + ph * 1.8 ) + ph * 6.28 ) * 0.025 * ( 1.0 + uExcite * 2.5 );',
          'float jump = max( 0.0, sin( uTime * ( 6.0 + ph * 2.0 ) + ph * 6.28 ) ) * 0.16 * uExcite * step( 0.45, ph );',
          'transformed.y += bob + jump + ( part > 1.5 && transformed.y > 0.5 ? uExcite * ( 0.3 + ph * 0.25 ) : 0.0 );',
          'vec3 skin = mix( vec3( 0.36, 0.22, 0.14 ), vec3( 0.93, 0.74, 0.6 ), fract( ph * 7.3 ) );',
          'vFan = part > 0.5 && part < 1.5 ? skin : instanceColor.rgb;',
        ].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFan;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vFan;');
  };
  m.customProgramCacheKey = () => 'racing-crowd';
  return { material: withHaze(m), time, excite };
}
