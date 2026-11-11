import * as THREE from 'three';
import { NAV_COLORS } from '../palette';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The floor under a mover's path: a dark rail slot with bright edges down
 * the middle, a faint dashed outline of all the floor it sweeps, and soft
 * chevrons that scroll the way it is moving and fade while it rests at an
 * end. u runs along the travel, v across it; uLength is the plane's length
 * in m, so dashes and chevrons keep their size on any path.
 */
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uRail;
uniform float uLength;
uniform float uWidth;
uniform float uDir;
uniform float uTime;
uniform float uActivity;
varying vec2 vUv;
void main() {
  vec2 m = vec2(vUv.x * uLength, (vUv.y - 0.5) * uWidth);
  float aa = fwidth(m.y) * 1.2;
  // The rail: a dark slot 0.32 m wide with a lit lip each side.
  float slot = 1.0 - smoothstep(0.16 - aa, 0.16 + aa, abs(m.y));
  float lip = 1.0 - smoothstep(0.012, 0.012 + aa, abs(abs(m.y) - 0.17));
  // The sweep outline, dashed every 0.3 m, 4 cm wide, inside the plane's edge.
  float ex = min(m.x, uLength - m.x);
  float ez = uWidth * 0.5 - abs(m.y);
  float edge = 1.0 - smoothstep(0.04, 0.04 + aa, min(ex, ez));
  float dash = step(0.5, fract((m.x + m.y) / 0.3));
  // Chevrons along the rail, scrolling with the motion.
  float s = fract((m.x - uDir * uTime * 1.2) / 0.9);
  float chev = abs(fract(s + uDir * abs(m.y) * 0.9) - 0.5);
  float arrow = (1.0 - smoothstep(0.06, 0.06 + aa * 2.0, abs(chev - 0.25))) * (1.0 - smoothstep(0.42, 0.5, abs(m.y) / (uWidth * 0.5))) * step(0.22, abs(m.y));
  vec3 col = uColor;
  float a = 0.07 + edge * dash * 0.6 + arrow * 0.4 * uActivity;
  col = mix(col, uRail, slot);
  a = max(a, slot * 0.85);
  col = mix(col, vec3(0.86, 0.88, 0.9), lip);
  a = max(a, lip * 0.9);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

/** The guide material for one mover. Its uniforms change every frame, so each mover has its own. */
export function moverGuideMaterial(length: number, width: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(NAV_COLORS.mover) },
      uRail: { value: new THREE.Color(NAV_COLORS.moverRail) },
      uLength: { value: length },
      uWidth: { value: width },
      uDir: { value: 1 },
      uTime: { value: 0 },
      uActivity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}
