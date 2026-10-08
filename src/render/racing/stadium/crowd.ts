import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';
import { withHaze } from '../world/atmosphere';
import { AISLE_EVERY, FRONT, ROW_DEPTH, ROWS, rowHeight } from './dimensions';

/**
 * A seated spectator: hips and thighs on the seat, a torso that narrows to
 * the shoulders, a neck and head, and two arms. A `part` attribute tells
 * the shader which is which: 0 takes the shirt color, 1 skin, 2 an arm
 * that lifts when the crowd cheers, 3 trousers. Smooth enough at the
 * distance a crowd is seen from, a few hundred triangles each.
 */
export function spectatorGeometry(): THREE.BufferGeometry {
  const arm = (s: number) => new THREE.CylinderGeometry(0.045, 0.05, 0.46, 6).rotateZ(s * 0.18).translate(s * 0.22, 0.7, 0.02);
  const pieces: Array<[THREE.BufferGeometry, number]> = [
    [new THREE.BoxGeometry(0.34, 0.14, 0.42).translate(0, 0.42, -0.08), 3],
    [new THREE.CylinderGeometry(0.15, 0.17, 0.5, 9).scale(1, 1, 0.72).translate(0, 0.72, 0.02), 0],
    [new THREE.SphereGeometry(0.17, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.15, 0.5, 0.75).translate(0, 0.96, 0.02), 0],
    [new THREE.CylinderGeometry(0.045, 0.05, 0.08, 6).translate(0, 1.04, 0.02), 1],
    [new THREE.SphereGeometry(0.105, 10, 8).scale(0.92, 1.1, 1).translate(0, 1.16, 0.03), 1],
    [arm(-1), 2],
    [arm(1), 2],
  ];
  const pos: number[] = [];
  const nrm: number[] = [];
  const part: number[] = [];
  for (const [g, p] of pieces) {
    const n = g.index ? g.toNonIndexed() : g;
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

/**
 * Shirt colors as a real crowd wears them: mostly white, grey, navy and
 * black, muted denim and khaki, with team blue and orange in a few, and
 * only the odd bright. Picked in sRGB and kept well short of full color.
 */
const SHIRTS = ['#e9e8e2', '#e9e8e2', '#d4d3cc', '#8d939a', '#2b3240', '#1d2026', '#3c5f8c', '#5b7290', '#b7a98a', '#7d6f5c', '#2f63b8', '#d9823d', '#9a3b33', '#5e7d55'];

/** Seat positions for one stand in its own frame, as instance matrices and shirt colors. */
export function seatCrowd(length: number, seed: number, occupancy: number): { matrices: Float32Array; colors: Float32Array; count: number } {
  const rng = new Rng(seed);
  const m = new THREE.Matrix4();
  const lean = new THREE.Matrix4();
  const c = new THREE.Color();
  const mats: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let x = -length / 2 + 0.7; x < length / 2 - 0.5; x += 0.56) {
      // Leave the aisles empty.
      const inAisle = ((x + length / 2 - 0.4) % AISLE_EVERY) > AISLE_EVERY - 1.5;
      if (inAisle || rng.next() > occupancy) continue;
      // People differ: build, height and how they sit, a few leaning forward or turned to a neighbor.
      const s = rng.range(0.9, 1.08);
      const tall = rng.range(0.92, 1.1);
      m.makeRotationY(Math.PI + rng.range(-0.35, 0.35)).multiply(lean.makeRotationX(rng.range(-0.05, 0.16))).scale(new THREE.Vector3(s, s * tall, s));
      m.setPosition(x + rng.range(-0.07, 0.07), rowHeight(r), FRONT + r * ROW_DEPTH + 0.42);
      mats.push(...m.elements);
      c.set(SHIRTS[rng.int(SHIRTS.length)]).toArray(cols, cols.length);
    }
  }
  return { matrices: Float32Array.from(mats), colors: Float32Array.from(cols), count: mats.length / 16 };
}

/**
 * The crowd's material. Everyone bobs a little on their own rhythm; when
 * `uExcite` rises (a car is close) they bounce, half of them jump up and
 * arms go in the air. Rows further back sit deeper under the roof and get
 * darker, hair tops the heads, and trousers stay dark. All in the vertex
 * shader, so a thousand fans cost one draw call and no CPU.
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
          'float bob = sin( uTime * ( 1.6 + ph * 1.8 ) + ph * 6.28 ) * 0.02 * ( 1.0 + uExcite * 2.5 );',
          'float jump = max( 0.0, sin( uTime * ( 6.0 + ph * 2.0 ) + ph * 6.28 ) ) * 0.16 * uExcite * step( 0.45, ph );',
          'float lift = part > 1.5 && part < 2.5 && transformed.y > 0.6 ? uExcite * ( 0.32 + ph * 0.25 ) : 0.0;',
          'transformed.y += bob + jump + lift;',
          'vec3 skin = mix( vec3( 0.3, 0.18, 0.11 ), vec3( 0.86, 0.66, 0.52 ), fract( ph * 7.3 ) );',
          'vec3 hair = mix( vec3( 0.05, 0.04, 0.035 ), vec3( 0.45, 0.33, 0.2 ), fract( ph * 3.7 ) * fract( ph * 3.7 ) );',
          'vec3 legs = mix( vec3( 0.07, 0.08, 0.1 ), vec3( 0.22, 0.26, 0.34 ), fract( ph * 5.1 ) );',
          'vec3 body = part < 0.5 || ( part > 1.5 && part < 2.5 ) ? instanceColor.rgb : part > 2.5 ? legs : skin;',
          // The top and back of the head is hair.
          'if ( part > 0.5 && part < 1.5 && position.y > 1.16 ) body = hair;',
          // Deeper rows sit further under the roof: less sky reaches them.
          'float rowShade = mix( 1.0, 0.58, smoothstep( 1.4, 7.5, root.y ) );',
          'vFan = body * rowShade;',
        ].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFan;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vFan;');
  };
  m.customProgramCacheKey = () => 'racing-crowd';
  return { material: withHaze(m), time, excite };
}
