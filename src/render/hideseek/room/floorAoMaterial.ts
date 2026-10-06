import * as THREE from 'three';

/**
 * Darkens the floor under the baked occlusion bands. The shade eases out
 * on a curve rather than a straight ramp, which is how light really falls
 * off into a corner.
 */
export function floorAoMaterial(strength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aShade;
      varying float vShade;
      void main() {
        vShade = aShade;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying float vShade;
      void main() {
        float a = vShade * vShade * (3.0 - 2.0 * vShade);
        gl_FragColor = vec4(0.11, 0.09, 0.07, a * a * uStrength);
      }
    `,
    uniforms: { uStrength: { value: strength } },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}
