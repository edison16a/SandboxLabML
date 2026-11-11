import * as THREE from 'three';
import { Effect } from 'postprocessing';

/** The grade's settings: a little warmth for late afternoon, a touch more color and a soft contrast curve. */
export const GRADE = { saturation: 1.1, contrast: 0.22, warmth: [1.035, 1.0, 0.965] as const };

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
 * sun, a little more saturation for paint and signals, and a soft contrast
 * curve. Subtle on purpose: it should feel like a good camera, not
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
