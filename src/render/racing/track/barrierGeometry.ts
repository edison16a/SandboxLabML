import * as THREE from 'three';
import type { Track } from '@/engine/racing/track/types';

/**
 * Cross section of a concrete safety wall, m: offset from the wall's middle
 * (positive away from the road) and height. The road face has the low
 * sloped foot that a tire rides up on before the wall turns it back, and a
 * lip near the top that carries the painted band.
 */
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [-0.34, 0],
  [-0.3, 0.08],
  [-0.15, 0.32],
  [-0.115, 0.76],
  [-0.11, 0.92],
  [0.11, 0.92],
  [0.15, 0.3],
  [0.3, 0],
];

/** Faces of the profile that carry the red and white band in bends: the lip and the top. */
const BAND_FACES = new Set([3, 4]);

const CONCRETE = new THREE.Color('#c8c2b6');
const SCUFF = new THREE.Color('#57585a');

/**
 * Continuous walls on both sides of the road at `offset` meters from the
 * centerline, following every bend. Each face of the profile gets its own
 * vertices, so edges stay crisp while the wall stays smooth along its run.
 * Low on the road face, black rubber scuffs show where tires touched it.
 */
export function barrierGeometry(track: Track, offset: number): THREE.BufferGeometry {
  const n = track.count;
  const faces = PROFILE.length - 1;
  const perSample = faces * 2;
  const count = (n + 1) * 2 * perSample;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  // Per vertex: meters along the road, and 1 where the band is painted.
  const band = new Float32Array(count * 2);
  const index: number[] = [];
  const c = new THREE.Color();
  let v = 0;
  for (const side of [1, -1]) {
    const base = v;
    for (let k = 0; k <= n; k++) {
      const i = k % n;
      const bendy = Math.abs(track.curvature[i]) > 1 / 50;
      for (let f = 0; f < faces; f++) {
        for (const p of [PROFILE[f], PROFILE[f + 1]]) {
          const off = side * (offset + p[0]);
          pos.set([track.cx[i] - track.ty[i] * off, p[1], -(track.cy[i] + track.tx[i] * off)], v * 3);
          c.copy(CONCRETE);
          if (f <= 2 && p[1] < 0.2) c.lerp(SCUFF, 0.55);
          c.toArray(col, v * 3);
          band[v * 2] = k * track.spacing;
          band[v * 2 + 1] = bendy && BAND_FACES.has(f) ? 1 : 0;
          v++;
        }
      }
    }
    for (let k = 0; k < n; k++) {
      for (let f = 0; f < faces; f++) {
        const a = base + k * perSample + f * 2;
        const b = a + perSample;
        // The two sides run in opposite senses, so flip the winding on one to keep faces outward.
        if (side > 0) index.push(a, b, a + 1, a + 1, b, b + 1);
        else index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('band', new THREE.BufferAttribute(band, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** GLSL for the band: 2 m red and white blocks from the distance along the road. */
const STRIPE = [
  '#include <color_fragment>',
  'vec3 stripe = fract( vBand.x / 4.0 ) < 0.5 ? vec3( 0.47, 0.012, 0.016 ) : vec3( 0.83, 0.82, 0.79 );',
  'diffuseColor.rgb = mix( diffuseColor.rgb, stripe, step( 0.5, vBand.y ) );',
].join('\n');

/**
 * The wall material: vertex colored concrete, with the band worked out per
 * pixel, so block edges stay sharp however coarsely the wall is sampled.
 */
export function createWallMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.8 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 band;\nvarying vec2 vBand;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBand = band;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vBand;').replace('#include <color_fragment>', STRIPE);
  };
  m.customProgramCacheKey = () => 'racing-wall';
  return m;
}
