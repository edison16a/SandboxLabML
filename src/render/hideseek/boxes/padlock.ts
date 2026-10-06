import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Padlock body size, m. The keyhole is drawn by the shader on its front and back. */
const BODY = { w: 0.36, h: 0.29, d: 0.11 };

/** The padlock body, centered on its own origin. */
export function padlockBodyGeometry(): THREE.BufferGeometry {
  return new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, 3, 0.045);
}

/** The shackle: a half ring on two short legs that sink into the top of the body. */
export function padlockShackleGeometry(): THREE.BufferGeometry {
  const r = 0.108;
  const tube = 0.03;
  const arc = new THREE.TorusGeometry(r, tube, 12, 28, Math.PI);
  arc.translate(0, BODY.h / 2 + 0.07, 0);
  const legs = [-r, r].map((x) => {
    const g = new THREE.CylinderGeometry(tube, tube, 0.1, 12, 1, true);
    g.translate(x, BODY.h / 2 + 0.02, 0);
    return g;
  });
  const merged = mergeGeometries([arc, ...legs]) as THREE.BufferGeometry;
  [arc, ...legs].forEach((g) => g.dispose());
  return merged;
}

const vertexShader = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vLocal;
varying float vWorldY;
void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  vWorldY = (modelMatrix * vec4(position, 1.0)).y;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uKeyhole;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vLocal;
varying float vWorldY;
void main() {
  float facing = abs(dot(normalize(vNormalV), normalize(vViewPos)));
  float rim = pow(1.0 - facing, 1.8);
  // Fine scan lines drifting up, the mark of a hologram.
  float scan = 0.92 + 0.08 * sin(vWorldY * 160.0 - uTime * 5.0);
  // A keyhole on the front and back: a round hole over a slot.
  vec2 k = vLocal.xy - vec2(0.0, 0.016);
  float hole = step(length(k), 0.038) + step(abs(k.x), 0.015) * step(k.y, 0.0) * step(-0.09, k.y);
  hole *= uKeyhole * step(0.045, abs(vLocal.z));
  vec3 color = mix(uColor, vec3(1.0), 0.3 + 0.6 * rim);
  float a = (0.78 + 0.22 * rim) * scan * (1.0 - 0.55 * min(hole, 1.0));
  color = mix(color, uColor * 0.6, min(hole, 1.0));
  gl_FragColor = vec4(color * (1.2 + 0.9 * rim), a * uOpacity);
  #include <colorspace_fragment>
}
`;

/**
 * The look of a lock hologram: a see through shape in the hider color, its
 * edges brighter and whiter, with drifting scan lines. Normal blending
 * rather than additive, so it still reads in front of a white wall; colors
 * go past 1 so bloom, where it runs, gives it a halo.
 */
export function hologramMaterial(color: THREE.Color, keyhole: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uColor: { value: color.clone() }, uOpacity: { value: 1 }, uTime: { value: 0 }, uKeyhole: { value: keyhole ? 1 : 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}
