import * as THREE from 'three';
import { Effect, EffectAttribute } from 'postprocessing';

const speedBlur = /* glsl */ `
uniform float strength;
uniform vec2 center;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (strength < 0.0005) {
    outputColor = inputColor;
    return;
  }
  // Streak toward the focus point: nothing near the middle, more toward the edges, like a lens at speed.
  vec2 dir = uv - center;
  float s = strength * smoothstep(0.1, 0.8, length(dir));
  vec4 sum = inputColor;
  for (int i = 1; i < 8; i++) sum += texture2D(inputBuffer, uv - dir * s * (float(i) / 7.0));
  outputColor = sum / 8.0;
}
`;

/**
 * Radial speed blur for the chase camera: the edges of the frame streak
 * toward the car as speed builds, while the car itself stays sharp. A real
 * camera tracking a fast car sees the same thing.
 */
export class SpeedBlurEffect extends Effect {
  constructor() {
    super('SpeedBlurEffect', speedBlur, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['strength', new THREE.Uniform(0)],
        ['center', new THREE.Uniform(new THREE.Vector2(0.5, 0.42))],
      ]),
    });
  }

  set strength(v: number) {
    (this.uniforms.get('strength') as THREE.Uniform<number>).value = v;
  }
}

/** The High grade's settings, shared with the landing hero, which bakes them into its tone curve (see heroGrade). */
export const GRADE = { saturation: 1.16, contrast: 0.28, warmth: [1.03, 1.0, 0.96] as const };

const grade = /* glsl */ `
uniform float saturation;
uniform float contrast;
uniform vec3 warmth;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * warmth;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  // A gentle S curve round mid grey: deeper shadows, brighter highlights.
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), contrast);
  outputColor = vec4(c, inputColor.a);
}
`;

/**
 * Color grading after tone mapping: a touch of warmth for late afternoon
 * sun, a little more saturation for the paint and the dry grass, and a soft
 * contrast curve. Subtle on purpose: it should feel like a good camera, not
 * a filter.
 */
export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', grade, {
      uniforms: new Map<string, THREE.Uniform>([
        ['saturation', new THREE.Uniform(GRADE.saturation)],
        ['contrast', new THREE.Uniform(GRADE.contrast)],
        ['warmth', new THREE.Uniform(new THREE.Vector3(...GRADE.warmth))],
      ]),
    });
  }
}
