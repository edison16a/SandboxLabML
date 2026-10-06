import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Vec3 = [number, number, number];

/**
 * A surface from a grid of points: `rows[i][j]`, where rows run along one
 * direction and columns along the other. Normals are smooth inside the grid,
 * so every panel of the car is its own grid and the creases between panels
 * stay sharp. UVs are in meters along both directions, so carbon weave and
 * paint flake keep the same scale on every panel.
 *
 * Winding: with rows advancing along +A and columns along +B, the face
 * normal points along A x B. Callers order rows and columns to point out.
 */
export function gridGeometry(rows: Vec3[][]): THREE.BufferGeometry {
  const nr = rows.length;
  const nc = rows[0].length;
  const pos = new Float32Array(nr * nc * 3);
  const uv = new Float32Array(nr * nc * 2);
  const along = new Float32Array(nc);
  for (let i = 0; i < nr; i++) {
    let across = 0;
    for (let j = 0; j < nc; j++) {
      const p = rows[i][j];
      if (j > 0) across += dist(p, rows[i][j - 1]);
      if (i > 0) along[j] += dist(p, rows[i - 1][j]);
      const k = i * nc + j;
      pos.set(p, k * 3);
      uv[k * 2] = along[j];
      uv[k * 2 + 1] = across;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < nc - 1; j++) {
      const a = i * nc + j;
      const b = a + nc;
      index.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** A flat polygon fan in a plane, for end caps and decals; `normal` picks which side faces out. */
export function polygonGeometry(points: Vec3[], normal: Vec3): THREE.BufferGeometry {
  const n = new THREE.Vector3(...normal).normalize();
  const u = new THREE.Vector3(Math.abs(n.y) > 0.9 ? 1 : 0, Math.abs(n.y) > 0.9 ? 0 : 1, 0).cross(n).normalize();
  const v = n.clone().cross(u);
  const flat = points.map((p) => new THREE.Vector2(u.dot(new THREE.Vector3(...p)), v.dot(new THREE.Vector3(...p))));
  const tris = THREE.ShapeUtils.triangulateShape(flat, []);
  const pos = new Float32Array(points.length * 3);
  const uv = new Float32Array(points.length * 2);
  points.forEach((p, i) => {
    pos.set(p, i * 3);
    uv.set([flat[i].x, flat[i].y], i * 2);
  });
  const index: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (const [a, b, c] of tris) {
    e1.set(...points[b]).sub(new THREE.Vector3(...points[a]));
    e2.set(...points[c]).sub(new THREE.Vector3(...points[a]));
    if (e1.cross(e2).dot(n) >= 0) index.push(a, b, c);
    else index.push(a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Mirrors a part across the car's centerline. Negative scale turns the
 * triangles inside out, so each triangle's winding is swapped back.
 */
export function mirrorZ(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = g.clone().scale(1, 1, -1);
  if (m.index) {
    const idx = m.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    m.index.needsUpdate = true;
    return m;
  }
  for (const name of Object.keys(m.attributes)) {
    const a = m.attributes[name];
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < a.itemSize; k++) {
        const t = a.getComponent(i + 1, k);
        a.setComponent(i + 1, k, a.getComponent(i + 2, k));
        a.setComponent(i + 2, k, t);
      }
    }
  }
  return m;
}

/** A part and its mirror image, for everything that comes in left and right pairs. */
export function bothSides(g: THREE.BufferGeometry): THREE.BufferGeometry {
  return merge([g, mirrorZ(g)]);
}

/**
 * Merges parts that may mix indexed and plain geometry, keeping only the
 * attributes the car uses so stray ones from three's primitives never block
 * the merge.
 */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const keep = ['position', 'normal', 'uv', 'color', 'surface'];
  const ready = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
    return g;
  });
  return mergeGeometries(ready) as THREE.BufferGeometry;
}
