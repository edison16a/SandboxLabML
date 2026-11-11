import * as THREE from 'three';
import type { Course } from '@/engine/navigation/course/build';
import { NAV_COLORS } from '../palette';

const vertexShader = /* glsl */ `
varying vec2 vFloor;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vFloor = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * The start zone, drawn on the floor from world position: a soft blue
 * wash that is strongest at the start line and fades toward the back wall,
 * a crisp start line, a ring on every spot of the start grid an agent
 * stands on (the same rows and fill order as engine/navigation/course/
 * formation.ts), so the crowd reads as lined up and the grid shows once it
 * has run off. Every edge is a distance with a pixel wide fade, so it
 * stays crisp from any distance.
 */
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uLine;
uniform float uFrontX;
uniform float uRowGap;
uniform float uSpacing;
uniform float uColumns;
uniform float uRows;
uniform float uCount;
varying vec2 vFloor;

// Fill order of spot j in a row of n: the middle first, then out to each side in turn.
float fillOrder(float j, float n) {
  float off = j - (n - 1.0) * 0.5;
  if (mod(n, 2.0) > 0.5) return off > 0.0 ? 2.0 * off - 1.0 : -2.0 * off;
  float m = abs(off) - 0.5;
  return off < 0.0 ? 2.0 * m : 2.0 * m + 1.0;
}

void main() {
  vec2 p = vFloor;
  float aa = max(fwidth(p.x), fwidth(p.y)) * 1.2;
  float behind = uLine - p.x;
  float zone = smoothstep(-aa, aa, behind);
  float wash = zone * (0.045 + 0.085 * exp(-behind * 0.45));
  float line = 1.0 - smoothstep(0.05 - aa, 0.05 + aa, abs(behind));

  // The nearest spot of the grid, and whether an agent stands on it.
  float row = floor((uFrontX - p.x) / uRowGap + 0.5);
  float spot = 0.0;
  if (row >= 0.0 && row < uRows) {
    float odd = mod(row, 2.0);
    float n = uColumns - odd;
    float j = clamp(floor(p.y / max(uSpacing, 1e-3) + (n - 1.0) * 0.5 + 0.5), 0.0, n - 1.0);
    vec2 c = vec2(uFrontX - row * uRowGap, (j - (n - 1.0) * 0.5) * uSpacing);
    float slot = floor(row / 2.0) * (2.0 * uColumns - 1.0) + odd * uColumns + fillOrder(j, n);
    float ring = 1.0 - smoothstep(0.022 - aa, 0.022 + aa, abs(length(p - c) - 0.25));
    spot = ring * step(slot + 0.5, uCount);
  }

  float a = max(max(wash, line * 0.92), spot * 0.5);
  vec3 col = mix(uColor, vec3(1.0), line * 0.55);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;

/** The start zone's material, set up for a course. uCount follows the feed every frame. */
export function startZoneMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(NAV_COLORS.startPad) },
      uLine: { value: 0 },
      uFrontX: { value: 0 },
      uRowGap: { value: 1 },
      uSpacing: { value: 1 },
      uColumns: { value: 1 },
      uRows: { value: 1 },
      uCount: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/** Points the material at a course's start line and grid. */
export function setStartZone(m: THREE.ShaderMaterial, course: Course): void {
  const f = course.formation;
  const u = m.uniforms;
  u.uLine.value = course.startX;
  u.uFrontX.value = f.frontX;
  u.uRowGap.value = f.rowGap;
  u.uSpacing.value = f.spacing;
  u.uColumns.value = f.columns;
  u.uRows.value = f.rows;
}
