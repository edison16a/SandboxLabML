import { HAZE_GLSL } from '../world/atmosphere';

/**
 * Camera facing quads, turned by each particle's spin. The world position
 * goes to the fragment shader for the ground fade, and the view position
 * for the haze.
 */
export const PARTICLE_VERTEX = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aLook;
attribute vec3 aColor;
varying vec2 vUv;
varying float vAlpha;
varying float vSoft;
varying vec3 vColor;
varying float vSeed;
varying float vSize;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vAlpha = aLook.y;
  vSoft = aLook.w;
  vColor = aColor;
  vSeed = aLook.z;
  vSize = aLook.x;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(aLook.z * 6.28);
  float s = sin(aLook.z * 6.28);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aLook.x;
  vWorld = aOffset + right * p.x + up * p.y;
  // A rough sphere normal per corner, in world space and unaffected by the spin, so the puff shades round with its lit side to the sun.
  vec3 toEye = normalize(cameraPosition - aOffset);
  vNormal = right * position.x * 1.6 + up * position.y * 1.6 + toEye * 0.6;
  vec4 view = viewMatrix * vec4(vWorld, 1.0);
  vView = view.xyz;
  gl_Position = projectionMatrix * view;
}
`;

/**
 * Soft puffs and hard flecks, lit like the rest of the world: sky light
 * from above and the warm sun, brighter on the side facing it and on top,
 * a little translucent glow where the sun shines through a thin puff. A
 * puff fades out where it meets the ground, so it never shows the hard
 * line of a card cutting the road, and the world's haze is applied last.
 */
export const PARTICLE_FRAGMENT = /* glsl */ `
uniform sampler2D uNoise;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uSunDir;
varying vec2 vUv;
varying float vAlpha;
varying float vSoft;
varying vec3 vColor;
varying float vSeed;
varying float vSize;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vNormal;
${HAZE_GLSL}
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float n = texture2D(uNoise, vUv * 0.6 + vSeed * 3.1).g;
  float n2 = texture2D(uNoise, vUv * 1.7 + vSeed * 5.3).r;
  float puff = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.7 + (n2 - 0.5) * 0.25);
  float a = mix(step(r, 0.85), puff, vSoft) * vAlpha;
  // Soft contact with the ground: a puff thins out over its lowest third.
  a *= mix(1.0, smoothstep(0.0, max(0.15, vSize * 0.35), vWorld.y), vSoft);
  if (a < 0.004) discard;
  vec3 viewDir = normalize(cameraPosition - vWorld);
  vec3 normal = normalize(vNormal);
  float sun = max(dot(normal, uSunDir), 0.0);
  float sky = 0.5 + 0.5 * normal.y;
  // Light passing through a thin puff toward the camera.
  float through = pow(max(dot(-viewDir, uSunDir), 0.0), 4.0) * (1.0 - puff * 0.6);
  vec3 light = mix(uGroundColor, uSkyColor, sky) * 0.7 + uSunColor * (sun * 0.6 + through * 0.5) * vSoft + uSunColor * 0.45 * (1.0 - vSoft);
  vec3 col = vColor * light;
  col = applyHaze(col, vView);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
