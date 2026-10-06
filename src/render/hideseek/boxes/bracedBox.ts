import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BoxSize } from '@/engine/hideseek/physics';

/** The two meshes of a braced crate: the gold panels and the light frame over them. */
export interface BracedBoxParts {
  panels: THREE.BufferGeometry;
  braces: THREE.BufferGeometry;
}

/** Edge frame thickness and face brace width, m. */
const EDGE = 0.07;
const BRACE = 0.052;
const BRACE_DEPTH = 0.026;
/** Faces narrower than this get no X brace, m. */
export const MIN_BRACED = 0.6;

/** One face of a box: its center, outward normal and the two in plane axes with half extents. */
export interface CrateFace {
  c: THREE.Vector3;
  n: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  hu: number;
  hv: number;
}

/** The five faces that can be seen: the bottom sits on the floor. */
export function crateFaces(s: BoxSize): CrateFace[] {
  const L = s.length / 2;
  const H = s.height / 2;
  const W = s.width / 2;
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return [
    { c: v3(L, H, 0), n: v3(1, 0, 0), u: v3(0, 0, -1), v: v3(0, 1, 0), hu: W, hv: H },
    { c: v3(-L, H, 0), n: v3(-1, 0, 0), u: v3(0, 0, 1), v: v3(0, 1, 0), hu: W, hv: H },
    { c: v3(0, H, W), n: v3(0, 0, 1), u: v3(1, 0, 0), v: v3(0, 1, 0), hu: L, hv: H },
    { c: v3(0, H, -W), n: v3(0, 0, -1), u: v3(-1, 0, 0), v: v3(0, 1, 0), hu: L, hv: H },
    { c: v3(0, 2 * H, 0), n: v3(0, 1, 0), u: v3(1, 0, 0), v: v3(0, 0, -1), hu: L, hv: W },
  ];
}

/** A bar of square ends from a to b, `w` wide across the face and `d` deep along the face normal. */
function bar(a: THREE.Vector3, b: THREE.Vector3, normal: THREE.Vector3, w: number, d: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new RoundedBoxGeometry(len + w * 0.6, w, d, 2, Math.min(w, d) * 0.32);
  const x = b.clone().sub(a).normalize();
  const z = normal.clone().sub(x.clone().multiplyScalar(normal.dot(x))).normalize();
  const y = z.clone().cross(x);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(a.clone().add(b).multiplyScalar(0.5)));
  return g;
}

/**
 * A crate in the style of the hide and seek classics: every face split into
 * square-ish panels, each panel a shallow pyramid so the four triangles
 * catch the light differently, with an X brace along the pyramid ridges and
 * a beveled frame on every edge. Panels and braces come back as separate
 * meshes so they can take different materials. Standing on the floor,
 * length along local x.
 */
export function bracedBox(s: BoxSize): BracedBoxParts {
  const tris: number[] = [];
  const braces: THREE.BufferGeometry[] = [];
  const push = (...ps: THREE.Vector3[]) => ps.forEach((p) => tris.push(p.x, p.y, p.z));
  for (const f of crateFaces(s)) {
    // A narrow face (a plank's top and ends) stays a plain panel: X braces that small would only look busy.
    const narrow = Math.min(f.hu, f.hv) * 2 < MIN_BRACED;
    const along = f.hu >= f.hv;
    const count = narrow ? 1 : Math.max(1, Math.round(along ? f.hu / f.hv : f.hv / f.hu));
    const pu = along ? f.hu / count : f.hu;
    const pv = along ? f.hv : f.hv / count;
    const bulge = narrow ? 0 : Math.min(pu, pv) * 0.16;
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * 2 * (along ? pu : pv);
      const c = f.c.clone().addScaledVector(along ? f.u : f.v, off);
      const corner = (su: number, sv: number) => c.clone().addScaledVector(f.u, su * pu).addScaledVector(f.v, sv * pv);
      const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      const apex = c.clone().addScaledVector(f.n, bulge);
      for (let i = 0; i < 4; i++) {
        push(ring[i], ring[(i + 1) % 4], apex);
        if (!narrow) braces.push(bar(ring[i], apex, f.n, BRACE, BRACE_DEPTH));
      }
      // A post between neighboring panels on a long face.
      if (k > 0) braces.push(bar(corner(-1, -1), along ? corner(-1, 1) : corner(1, -1), f.n, BRACE, BRACE_DEPTH));
    }
  }
  const L = s.length / 2;
  const W = s.width / 2;
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (const y of [0, s.height]) {
    for (const z of [-W, W]) braces.push(bar(v3(-L, y, z), v3(L, y, z), v3(0, 0, Math.sign(z)), EDGE, EDGE));
    for (const x of [-L, L]) braces.push(bar(v3(x, y, -W), v3(x, y, W), v3(Math.sign(x), 0, 0), EDGE, EDGE));
  }
  for (const x of [-L, L]) for (const z of [-W, W]) braces.push(bar(v3(x, 0, z), v3(x, s.height, z), v3(Math.sign(x), 0, 0), EDGE, EDGE));
  const panels = new THREE.BufferGeometry();
  panels.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  panels.computeVertexNormals();
  const merged = mergeGeometries(braces) as THREE.BufferGeometry;
  braces.forEach((b) => b.dispose());
  return { panels, braces: merged };
}
