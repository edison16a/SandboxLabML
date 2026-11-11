import * as THREE from 'three';
import { NAV_COLORS } from '../palette';

/**
 * A faint wash of light rising from the finish line: strongest at the
 * floor, gone by head height, softened at its ends. Added light, so it
 * brightens what is behind it without hiding it, and drawn from both sides.
 */
export function curtainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float rise = pow(1.0 - vUv.y, 2.4);
        float ends = smoothstep(0.0, 0.06, vUv.x) * smoothstep(0.0, 0.06, 1.0 - vUv.x);
        gl_FragColor = vec4(uColor * rise * ends * 0.32, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: { uColor: { value: new THREE.Color(NAV_COLORS.finishGlow) } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
