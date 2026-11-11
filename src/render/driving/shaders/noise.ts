/**
 * Small GLSL noise helpers shared by the city's shaders: a hash, smooth
 * value noise and a few octaves of it. Prefixed so they never clash with
 * three's own chunks.
 */
export const NOISE_GLSL = /* glsl */ `
float cityHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float cityNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cityHash(i), cityHash(i + vec2(1.0, 0.0)), u.x), mix(cityHash(i + vec2(0.0, 1.0)), cityHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float cityFbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int o = 0; o < 4; o++) {
    s += cityNoise(p) * a;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return s;
}
`;
