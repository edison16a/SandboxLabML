import * as THREE from 'three';
import { withHaze } from '../world/atmosphere';
import { JOINTS } from './personGeometry';

const f = (v: number) => v.toFixed(4);

/**
 * The walk cycle, in the vertex shader. Each leg swings from the hip and
 * bends at the knee as it comes through; each arm swings against its leg
 * and bends a little at the elbow; the body bobs twice per cycle. A
 * person waiting stands with a slight sway. `aAnim` is (walk phase 0 to
 * 1, state, unused, seed); the state is the world's (1 means waiting).
 */
const WALK = /* glsl */ `
attribute float aPart;
attribute vec2 aLimb;
attribute vec4 aAnim;
uniform float uPeopleTime;
vec3 personRot(vec3 p, vec3 pivot, float a) {
  vec3 d = p - pivot;
  float c = cos(a);
  float s = sin(a);
  return pivot + vec3(d.x * c - d.y * s, d.x * s + d.y * c, d.z);
}
vec3 personPose(vec3 p, inout vec3 n) {
  float phase = aAnim.x * 6.2831853;
  float walking = abs(aAnim.y - 1.0) < 0.5 ? 0.0 : 1.0;
  float limb = aLimb.x;
  float lower = aLimb.y;
  float side = abs(limb - 1.0) < 0.5 || abs(limb - 3.0) < 0.5 ? 1.0 : -1.0;
  float ph = phase + (side > 0.0 ? 0.0 : 3.14159265);
  float idle = sin(uPeopleTime * 1.1 + aAnim.w * 6.28);
  if (limb > 0.5 && limb < 2.5) {
    float thigh = walking * 0.44 * sin(ph);
    float knee = walking * (1.0 * max(0.0, sin(ph - 1.25)) + 0.1) + (1.0 - walking) * 0.05;
    vec3 hip = vec3(0.0, ${f(JOINTS.hip)}, side * ${f(JOINTS.hipZ)});
    vec3 kn = vec3(0.0, ${f(JOINTS.knee)}, side * ${f(JOINTS.hipZ)});
    if (lower > 0.5) {
      p = personRot(p, kn, -knee);
      n = personRot(n, vec3(0.0), -knee);
    }
    p = personRot(p, hip, thigh);
    n = personRot(n, vec3(0.0), thigh);
  } else if (limb > 2.5) {
    float swing = walking * -0.36 * sin(ph) + (1.0 - walking) * 0.025 * idle;
    float elbow = walking * (0.28 + 0.22 * max(0.0, -sin(ph))) + (1.0 - walking) * 0.1;
    vec3 sh = vec3(0.0, ${f(JOINTS.shoulder)}, side * ${f(JOINTS.shoulderZ)});
    vec3 el = vec3(0.0, ${f(JOINTS.elbow)}, side * ${f(JOINTS.shoulderZ)});
    if (lower > 0.5) {
      p = personRot(p, el, elbow);
      n = personRot(n, vec3(0.0), elbow);
    }
    p = personRot(p, sh, swing);
    n = personRot(n, vec3(0.0), swing);
  }
  // A bob twice per cycle, a small forward lean while walking and a sway while waiting.
  float upper = smoothstep(0.85, 1.1, p.y);
  p.y += walking * 0.024 * (0.5 - 0.5 * cos(2.0 * phase));
  p.x += upper * (walking * 0.035 * (p.y - 0.9) + (1.0 - walking) * 0.012 * idle);
  return p;
}
`;

/** Dresses each vertex from its instance's palette: skin, shirt, trousers, shoes or hair. */
const DRESS = /* glsl */ `
attribute vec3 aSkin;
attribute vec3 aShirt;
attribute vec3 aPants;
attribute vec3 aHair;
varying vec3 vDress;
`;

export function createPersonMaterial(time: { value: number }): { material: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial } {
  const material = withHaze(new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, envMapIntensity: 0.7 }));
  const before = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uPeopleTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WALK}\n${DRESS}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3( normal );\nvec3 personP = personPose( position, objectNormal );')
      .replace('#include <begin_vertex>', `vec3 transformed = personP;
        vDress = aPart < 0.5 ? aSkin : aPart < 1.5 ? aShirt : aPart < 2.5 ? aPants : aPart < 3.5 ? vec3(0.03, 0.03, 0.035) + aPants * 0.12 : aHair;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDress;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vDress;');
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|person`;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.uPeopleTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${WALK}`).replace('#include <begin_vertex>', 'vec3 personN = vec3( 0.0, 1.0, 0.0 );\nvec3 transformed = personPose( position, personN );');
  };
  depth.customProgramCacheKey = () => 'person-depth';
  return { material, depth };
}
