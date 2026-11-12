import * as THREE from 'three';
import { RIG } from './proportions';

/**
 * Flat face marks, drawn in meters on the face (u to the character's
 * left, v up) and then wrapped onto the head. Flat shapes keep the strokes
 * crisp at any zoom, with no texture to blur.
 */

/** A thick arc with round ends, like one pen stroke. Angles in radians, counterclockwise from +u. */
export function arcStroke(cx: number, cy: number, r: number, a0: number, a1: number, width: number): THREE.Shape {
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

export function ellipse(cx: number, cy: number, rx: number, ry: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
}

/** An open smile: a top edge that curls up at the corners over a round bottom, like a sideways D. */
export function grin(cx: number, cy: number, w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(cx - w, cy + h * 0.12);
  s.quadraticCurveTo(cx, cy - h * 0.08, cx + w, cy + h * 0.12);
  s.absellipse(cx, cy, w, h, 0.08, Math.PI - 0.08, true, 0);
  return s;
}

/** A rectangle with fully rounded ends, w wide and h tall. */
export function pill(cx: number, cy: number, w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const r = h / 2;
  s.moveTo(cx - w / 2 + r, cy - r);
  s.lineTo(cx + w / 2 - r, cy - r);
  s.absarc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(cx - w / 2 + r, cy + r);
  s.absarc(cx - w / 2 + r, cy, r, Math.PI / 2, (3 * Math.PI) / 2, false);
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

/**
 * The point (u, v) of the face, m, wrapped onto the head round the face
 * elevation `e0` rad and `lift` m off its surface: it lands at azimuth
 * u / R and elevation e0 + v / R, so sizes on the face stay true, and then
 * takes the head's bun scale. `normal` gets the direction out of the head.
 */
export function headPoint(u: number, v: number, e0: number, lift: number, out: THREE.Vector3, normal?: THREE.Vector3): THREE.Vector3 {
  const R = RIG.headRadius;
  const [sx, sy, sz] = RIG.headScale;
  const a = u / R;
  const e = e0 + v / R;
  // u runs toward -z, the character's left: that keeps the shapes' winding facing out of the head.
  const nx = Math.cos(e) * Math.cos(a);
  const ny = Math.sin(e);
  const nz = -Math.cos(e) * Math.sin(a);
  normal?.set(nx, ny, nz);
  return out.set(nx * (R * sx + lift), ny * (R * sy + lift), nz * (R * sz + lift));
}

/**
 * Wraps flat shapes onto the head (see headPoint), as offsets from
 * `origin`: the point a bone sits on, so the mark scales from there.
 */
export function wrapOnHead(shapes: THREE.Shape[], e0: number, lift: number, curve: number, origin: THREE.Vector3): THREE.BufferGeometry {
  const g = subdivide(new THREE.ShapeGeometry(shapes, curve));
  const pos = g.attributes.position;
  const normals = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    headPoint(pos.getX(i), pos.getY(i), e0, lift, p, n);
    pos.setXYZ(i, p.x - origin.x, p.y - origin.y, p.z - origin.z);
    normals.set([n.x, n.y, n.z], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}
