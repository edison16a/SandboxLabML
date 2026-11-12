import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TrafficDetail } from '../body/detail';
import { doorMirror } from '../body/fittings';
import { axles } from '../body/frame';
import { wheelLiners } from '../body/liners';
import { Projector } from '../body/project';
import { buildShell } from '../body/shell';
import { WHEEL_BUILT } from '../trafficMotion';
import { trafficWheelGeometry } from '../wheelGeometry';
import type { CarShape } from '../shape/types';

/**
 * Helpers for the body tests: which part a triangle belongs to, and a ray
 * check that finds holes. Test only; nothing in the app imports this.
 */

/** A triangle of a built body: its points, face normal, smooth normals and which part it is. */
export interface Face {
  p: THREE.Vector3[];
  n: THREE.Vector3;
  vn: THREE.Vector3[];
  part: 'body' | 'liner' | 'mirror' | 'underbody';
}

type Positions = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

/** A triangle's centroid as a key, the same on both halves, so a part's triangles can be found in the merged body. */
function centroidKey(pos: Positions, i: number): string {
  const c = [0, 1, 2].map((k) => (pos.getComponent(i, k) + pos.getComponent(i + 1, k) + pos.getComponent(i + 2, k)) / 3);
  return `${c[0].toFixed(4)},${c[1].toFixed(4)},${Math.abs(c[2]).toFixed(4)}`;
}

function keysOf(g: THREE.BufferGeometry): Set<string> {
  const flat = g.index ? g.toNonIndexed() : g;
  const out = new Set<string>();
  for (let i = 0; i < flat.attributes.position.count; i += 3) out.add(centroidKey(flat.attributes.position, i));
  return out;
}

/** Every triangle of a geometry, skipping slivers with no area, with `partOf` naming each one's part. */
function facesOf(g: THREE.BufferGeometry, partOf: (key: string) => Face['part']): Face[] {
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const out: Face[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const p = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, i + k));
    const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    if (n.length() < 1e-9) continue;
    out.push({ p, n: n.normalize(), vn: [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(nrm, i + k)), part: partOf(centroidKey(pos, i)) });
  }
  return out;
}

/**
 * Every triangle of a built body. Liners, mirrors and the underbody are
 * found by position, built again from the same helpers, so no look or
 * color has to stand in for them.
 */
export function faces(g: THREE.BufferGeometry, s: CarShape, d: TrafficDetail): Face[] {
  const shell = buildShell(s, d);
  const liners = keysOf(wheelLiners(s, d));
  const mirrors = keysOf(doorMirror(s, new Projector(shell.panels), d.fine));
  const under = keysOf(shell.underbody);
  return facesOf(g, (key) => (liners.has(key) ? 'liner' : mirrors.has(key) ? 'mirror' : under.has(key) ? 'underbody' : 'body'));
}

/** The four wheels in place, as the street sees them: tires fill the openings. */
export function wheelFaces(s: CarShape): Face[] {
  const parts: THREE.BufferGeometry[] = [];
  const k = s.wheelRadius / WHEEL_BUILT;
  for (const x of axles(s)) {
    for (const side of [1, -1]) {
      const w = trafficWheelGeometry(WHEEL_BUILT, 12).scale(k, k, 1);
      if (side < 0) w.rotateY(Math.PI);
      parts.push(w.translate(x, s.wheelRadius, side * s.track));
    }
  }
  return facesOf(mergeGeometries(parts) as THREE.BufferGeometry, () => 'body');
}

const ray = new THREE.Ray();
const hit = new THREE.Vector3();

/**
 * Looks at the body from one side along a grid of straight rays and
 * counts rays whose first hit is the inside of a surface: wherever the
 * body has a hole, a ray slips through and meets a face from behind.
 * Liners face their wheel by design, so a ray that slips under a bumper
 * into a wheel opening may meet one from behind, where in the street the
 * tire would stop it; `forgiveLiners` allows that for rays from the sides
 * and ends. From above nothing is forgiven.
 */
export function seenFromInside(tris: Face[], dir: THREE.Vector3, box: THREE.Box3, forgiveLiners: boolean): number {
  const axis = Math.abs(dir.x) > 0.5 ? 0 : Math.abs(dir.y) > 0.5 ? 1 : 2;
  const [a, b] = [0, 1, 2].filter((k) => k !== axis);
  const min = box.min.toArray();
  const max = box.max.toArray();
  let bad = 0;
  for (let i = 1; i < 40; i++) {
    for (let j = 1; j < 24; j++) {
      const o = [0, 0, 0];
      o[a] = min[a] + ((max[a] - min[a]) * i) / 40;
      o[b] = min[b] + ((max[b] - min[b]) * j) / 24;
      o[axis] = dir.getComponent(axis) > 0 ? min[axis] - 1 : max[axis] + 1;
      ray.set(new THREE.Vector3(...o), dir);
      let best = Infinity;
      let facing = 1;
      for (const t of tris) {
        if (!ray.intersectTriangle(t.p[0], t.p[1], t.p[2], false, hit)) continue;
        const d = hit.distanceTo(ray.origin);
        if (d < best) {
          best = d;
          // A ray that skims a thin piece lying along it (a pillar on the glass, seen from behind)
          // meets its edge, not a hole: within about 3 degrees of grazing it counts as seen.
          facing = (forgiveLiners && t.part === 'liner') || Math.abs(t.n.dot(dir)) < 0.05 ? 1 : -t.n.dot(dir);
        }
      }
      if (best < Infinity && facing < 0) bad++;
    }
  }
  return bad;
}
