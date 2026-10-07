import * as THREE from 'three';
import { RING_SIZE } from './characterKit';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * ${RING_SIZE.toFixed(3)};
  // A crisp band of light round the feet, a soft halo either side of it and a faint pool inside.
  float band = exp(-pow((r - 0.5) / 0.028, 2.0));
  float halo = exp(-pow((r - 0.5) / 0.15, 2.0)) * 0.38;
  float pool = (1.0 - smoothstep(0.0, 0.5, r)) * 0.16;
  float pulse = 0.9 + 0.1 * sin(uTime * 3.2);
  float a = clamp((band + halo + pool) * uStrength * pulse, 0.0, 1.0);
  gl_FragColor = vec4(uColor * (1.0 + 2.2 * band), a);
  #include <colorspace_fragment>
}
`;

/**
 * The glowing ring on the floor round a seeker's feet, as in the hide and
 * seek classics: a crisp band with a soft halo. Its color goes past 1, so
 * bloom (where it runs) makes it glow; plain alpha blending keeps it
 * visible on the pale tiles, where added light would vanish.
 */
export function seekerRingMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uColor: { value: color.clone() }, uStrength: { value: 1 }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}
