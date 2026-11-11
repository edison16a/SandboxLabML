import * as THREE from 'three';

const quadVertex = /* glsl */ `
attribute vec2 aBeam;
varying vec2 vUv;
varying vec3 vColor;
varying vec2 vBeam;
void main() {
  vUv = uv;
  vColor = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #endif
  vBeam = aBeam;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}
`;

/**
 * A sensor beam: a flat ribbon from the agent to what the ray meets, faint
 * at the agent and stronger toward the end, soft across its width. A ray
 * that hits takes the color of what it hit at its end; one that hits
 * nothing fades out before its full reach. aBeam is (hit, highlighted).
 */
export function beamMaterial(base: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec2 vBeam;
      void main() {
        float along = vUv.x;
        float across = abs(vUv.y - 0.5) * 2.0;
        float body = 1.0 - smoothstep(0.15, 1.0, across);
        float core = 1.0 - smoothstep(0.0, 0.35, across);
        float hit = vBeam.x;
        float a = mix(0.18, 0.7, pow(along, 1.3)) * mix(0.55, 1.0, core);
        a *= mix(1.0 - smoothstep(0.55, 1.0, along), 1.0, hit);
        vec3 col = mix(uBase, vColor, hit * smoothstep(0.35, 1.0, along));
        col = mix(col, vec3(0.07, 0.09, 0.14), vBeam.y);
        a = mix(a, 0.95, vBeam.y);
        gl_FragColor = vec4(col, a * body);
        #include <colorspace_fragment>
      }
    `,
    uniforms: { uBase: { value: base.clone() } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/**
 * A mark on the floor: a soft round dot for the path hint trail, or a
 * double chevron for the goal arrow. Each instance's color comes from the
 * instance color, and aBeam.x is its opacity.
 */
export function floorMarkMaterial(shape: 'dot' | 'chevron'): THREE.ShaderMaterial {
  const sdf =
    shape === 'dot'
      ? 'float d = length(p) - 0.5;'
      : // Two chevrons pointing along +x, the front one stronger.
        'vec2 q = vec2(p.x, abs(p.y)); float c1 = abs(q.x - 0.18 + q.y * 0.9) - 0.07; float c2 = abs(q.x + 0.14 + q.y * 0.9) - 0.07; float d = max(min(c1, c2), q.y - 0.42);';
  return new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      varying vec2 vBeam;
      void main() {
        vec2 p = vUv - 0.5;
        ${sdf}
        float aa = fwidth(d) * 1.5;
        float a = 1.0 - smoothstep(-aa, aa, d);
        gl_FragColor = vec4(vColor, a * vBeam.x);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * Hit markers: round points with a bright core and a ring in the color of
 * what was hit, sized in meters so they read the same near and far.
 */
export function hitMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      uniform float uScale;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 0.24 * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.32, 0.42, r);
        float ring = 1.0 - smoothstep(0.08, 0.16, abs(r - 0.72));
        float a = max(core, ring * 0.9);
        vec3 col = mix(vColor, vec3(1.0), core * 0.55);
        gl_FragColor = vec4(col * 1.35, a);
        #include <colorspace_fragment>
      }
    `,
    uniforms: { uScale: { value: 500 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}
