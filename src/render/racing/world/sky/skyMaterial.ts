import * as THREE from 'three';
import { ATMOSPHERE, HAZE_GLSL, SUN_DIR, hazeUniforms } from '../atmosphere';

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Pin the dome to the far plane so it never clips the hills and never hides anything.
  gl_Position = p.xyww;
}
`;

const fragment = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform float uTime;
uniform float uOctaves;
varying vec3 vDir;
${HAZE_GLSL}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int o = 0; o < 6; o++) {
    if (float(o) >= uOctaves) break;
    s += noise(p) * a;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float up = max(d.y, 0.0);
  float mu = dot(d, uSunDir);
  // Deep blue overhead easing to a pale horizon.
  vec3 sky = mix(uHorizon, uZenith, pow(up, 0.38));
  // Forward scattering round the sun, a wide glow and a tight one.
  sky += uSun * (pow(max(mu, 0.0), 6.0) * 0.28 + pow(max(mu, 0.0), 120.0) * 0.9);
  // Clouds on a flat layer overhead: soft cumulus, lit on the sun side, grey underneath.
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(uTime * 0.004, uTime * 0.0015);
    // Big soft shapes from a low octave decide where clouds are; the fbm adds their billows.
    float mass = noise(uv * 0.35 + 3.1);
    float n = fbm(uv) * 0.75 + mass * 0.45;
    float cover = smoothstep(0.6, 0.8, n);
    float lit = clamp(0.62 + (n - fbm(uv + uSunDir.xz * 0.06) * 0.75 - mass * 0.45) * 3.5, 0.3, 1.0);
    vec3 cloud = mix(vec3(0.55, 0.6, 0.7), vec3(1.25, 1.2, 1.12), lit) + uSun * pow(max(mu, 0.0), 8.0) * 0.6;
    sky = mix(sky, cloud, cover * smoothstep(0.0, 0.12, d.y) * 0.95);
  }
  // The same aerial haze as the ground, taken out to the far plane, so the horizon and far hills match.
  vec3 hd = normalize(vec3(d.x, max(d.y, 0.002), d.z));
  sky = mix(sky, hazeColor(hd), hazeAmount(hd, 4800.0));
  // The sun's disk, after the haze so it stays crisp.
  sky += uSun * smoothstep(0.99975, 0.9999, mu) * 24.0 * smoothstep(-0.02, 0.03, d.y);
  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The sky: a gradient, a sun with its glow, drifting clouds and the same
 * haze the ground uses. `octaves` sets cloud detail, fewer on Low.
 */
export function createSkyMaterial(octaves: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      ...hazeUniforms,
      uSunDir: { value: SUN_DIR },
      uZenith: { value: ATMOSPHERE.zenith },
      uHorizon: { value: ATMOSPHERE.horizon },
      uSun: { value: ATMOSPHERE.sun },
      uTime: { value: 0 },
      uOctaves: { value: octaves },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}
