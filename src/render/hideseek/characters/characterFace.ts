import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Expression } from './characterMotion';
import { RIG } from './characterGeometry';

/**
 * The faces are drawn flat, in meters on the face (u to the side, v up),
 * then wrapped onto the head sphere. Flat shapes keep the strokes crisp at
 * any zoom, with no texture to blur.
 */

/** A thick arc with round ends, like one pen stroke. Angles in radians, counterclockwise from +u. */
function arcStroke(cx: number, cy: number, r: number, a0: number, a1: number, width: number): THREE.Shape {
  const s = new THREE.Shape();
  const ro = r + width / 2;
  const ri = r - width / 2;
  s.moveTo(cx + Math.cos(a0) * ro, cy + Math.sin(a0) * ro);
  s.absarc(cx, cy, ro, a0, a1, false);
  s.absarc(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, width / 2, a1, a1 + Math.PI, false);
  s.absarc(cx, cy, ri, a1, a0, true);
  s.absarc(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, width / 2, a0 + Math.PI, a0 + 2 * Math.PI, false);
  s.autoClose = true;
  return s;
}

function ellipse(cx: number, cy: number, rx: number, ry: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
}

/** An open smile: a top edge that curls up at the corners over a round bottom, like a sideways D. */
function grin(cx: number, cy: number, w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(cx - w, cy + h * 0.12);
  s.quadraticCurveTo(cx, cy - h * 0.08, cx + w, cy + h * 0.12);
  s.absellipse(cx, cy, w, h, 0.08, Math.PI - 0.08, true, 0);
  return s;
}

/** Splits every triangle into four, so flat shapes can bend round the head without sinking into it. */
function subdivide(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = (g.index ? g.toNonIndexed() : g).attributes.position.array as ArrayLike<number>;
  const out: number[] = [];
  const mid = (a: number, b: number) => [(src[a] + src[b]) / 2, (src[a + 1] + src[b + 1]) / 2, 0];
  for (let i = 0; i < src.length; i += 9) {
    const a = [src[i], src[i + 1], 0];
    const b = [src[i + 3], src[i + 4], 0];
    const c = [src[i + 6], src[i + 7], 0];
    const ab = mid(i, i + 3);
    const bc = mid(i + 3, i + 6);
    const ca = mid(i + 6, i);
    out.push(...a, ...ab, ...ca, ...ab, ...b, ...bc, ...ca, ...bc, ...c, ...ab, ...bc, ...ca);
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return r;
}

/** How far the marks float off the head, m: enough to never sink into it, too little to see. */
const LIFT = 0.0035;

/**
 * Wraps flat face shapes onto the head sphere. A point (u, v) lands at
 * azimuth u / R and elevation v / R from the front of the head (+x), so
 * sizes on the face stay true. Normals point straight out of the head.
 */
function wrap(shapes: THREE.Shape[], coarse: boolean): THREE.BufferGeometry {
  // One split is enough: a face mark is at most 0.17 m across, so its halves sag under 2 mm, less than the lift.
  const g = subdivide(new THREE.ShapeGeometry(shapes, coarse ? 4 : 14));
  const lift = coarse ? LIFT * 2 : LIFT;
  const pos = g.attributes.position;
  const normals = new Float32Array(pos.count * 3);
  const R = RIG.headRadius;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i) / R;
    const e = pos.getY(i) / R;
    const nx = Math.cos(e) * Math.cos(a);
    const ny = Math.sin(e);
    // u runs toward -z, the character's left: that keeps the shapes' winding facing out of the head.
    const nz = -Math.cos(e) * Math.sin(a);
    pos.setXYZ(i, nx * (R + lift), ny * (R + lift), nz * (R + lift));
    normals.set([nx, ny, nz], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}

/** Eye spacing from the middle of the face, and the eye line height, m on the face. */
const EYE_U = 0.122;
const EYE_V = 0.05;

/** Shapes for each face: closed smiling eyes, sleepy lids, startled round eyes and a keen open look. */
function faceShapes(expression: Expression | 'blink'): THREE.Shape[] {
  const eyes = (make: (u: number) => THREE.Shape) => [make(-EYE_U), make(EYE_U)];
  switch (expression) {
    case 'happy':
      return [...eyes((u) => arcStroke(u, EYE_V - 0.024, 0.052, 0.32, Math.PI - 0.32, 0.027)), grin(0, -0.075, 0.074, 0.07)];
    case 'blink':
      return [...eyes((u) => arcStroke(u, EYE_V - 0.024, 0.052, 0.32, Math.PI - 0.32, 0.027)), grin(0, -0.078, 0.084, 0.076)];
    case 'sleep':
      return [...eyes((u) => arcStroke(u, EYE_V + 0.034, 0.056, Math.PI + 0.55, 2 * Math.PI - 0.55, 0.023)), ellipse(0, -0.09, 0.024, 0.018)];
    case 'startled':
      return [...eyes((u) => ellipse(u, EYE_V, 0.036, 0.043)), ellipse(0, -0.097, 0.036, 0.047)];
    case 'keen':
      return [...eyes((u) => ellipse(u, EYE_V, 0.031, 0.045)), grin(0, -0.078, 0.084, 0.076)];
  }
}

/** The face marks for one expression, wrapped and merged into one mesh. Coarse is for the far away instanced crowds. */
export function faceGeometry(expression: Expression | 'blink', coarse = false): THREE.BufferGeometry {
  const parts = faceShapes(expression).map((s) => wrap([s], coarse));
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Every face, keyed by expression. 'blink' is the keen face with its eyes shut. */
export const FACES = ['happy', 'sleep', 'startled', 'keen', 'blink'] as const;
export type FaceKey = (typeof FACES)[number];
