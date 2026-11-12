import * as THREE from 'three';
import { onCap } from './body';
import { gridGeometry, type Vec3 } from './grid';
import type { Pt } from './section';

/**
 * A closed outline on the face from its corners, each corner rounded with
 * radius `r` in `steps` points. Corners go round counterclockwise in (z, y).
 */
export function rounded(corners: Pt[], r: number, steps: number): Pt[] {
  const out: Pt[] = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const [p, c, q] = [corners[(i + n - 1) % n], corners[i], corners[(i + 1) % n]];
    const a = unit([p[0] - c[0], p[1] - c[1]]);
    const b = unit([q[0] - c[0], q[1] - c[1]]);
    // Pull the radius in on a short edge, so tight corners never cross.
    const k = Math.min(r, Math.hypot(p[0] - c[0], p[1] - c[1]) * 0.45, Math.hypot(q[0] - c[0], q[1] - c[1]) * 0.45);
    const s: Pt = [c[0] + a[0] * k, c[1] + a[1] * k];
    const e: Pt = [c[0] + b[0] * k, c[1] + b[1] * k];
    // A quadratic from one tangent point to the other, with the corner as its handle.
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      out.push([(1 - t) ** 2 * s[0] + 2 * (1 - t) * t * c[0] + t * t * e[0], (1 - t) ** 2 * s[1] + 2 * (1 - t) * t * c[1] + t * t * e[1]]);
    }
  }
  return out;
}

const unit = ([z, y]: Pt): Pt => {
  const l = Math.hypot(z, y) || 1;
  return [z / l, y / l];
};

/** A closed counterclockwise outline moved out by `d` m (negative pulls it in), each point along its corner's normal. */
export function offset(pts: Pt[], d: number): Pt[] {
  const n = pts.length;
  return pts.map((c, i) => {
    const p = pts[(i + n - 1) % n];
    const q = pts[(i + 1) % n];
    const e1 = unit([c[0] - p[0], c[1] - p[1]]);
    const e2 = unit([q[0] - c[0], q[1] - c[1]]);
    // Outward is to the right of travel on a counterclockwise outline.
    const n1: Pt = [e1[1], -e1[0]];
    const m = unit([n1[0] + e2[1], n1[1] - e2[0]]);
    const k = d / Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]);
    return [c[0] + m[0] * k, c[1] + m[1] * k];
  });
}

/** Turns a geometry's triangles round if they face away from `dir`, so it shows from outside. */
export function facing(g: THREE.BufferGeometry, dir: Vec3): THREE.BufferGeometry {
  const n = g.attributes.normal;
  let dot = 0;
  for (let i = 0; i < n.count; i++) dot += n.getX(i) * dir[0] + n.getY(i) * dir[1] + n.getZ(i) * dir[2];
  if (dot >= 0 || !g.index) return g;
  const idx = g.index.array;
  for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  g.index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** How far the mesh sits off the face: enough that its flat triangles never dip behind the curved paint. */
const MESH_LIFT = 0.01;

export interface Recess {
  /** The gloss black bezel: it rises from the paint to a lip and steps back down inside. */
  bezel: THREE.BufferGeometry;
  /** The mesh filling the back of the opening, on the face itself. */
  mesh: THREE.BufferGeometry;
}

/**
 * An intake on the nose or tail with real depth. The bezel's outer edge
 * lies on the paint `width` m outside the opening and rises to a rounded
 * lip `depth` m proud of the face at the opening; inside, a wall drops
 * straight back to the mesh. From any angle but dead ahead the wall
 * shows and the lip catches a line of light, so the mesh reads as set
 * deep into the bumper. `outline` is counterclockwise in (z, y).
 */
export function recess(end: 1 | -1, outline: Pt[], depth: number, width: number, rings: number): Recess {
  const ring = [...outline, outline[0]];
  // Across the bezel: outer edge, two points up the rise, the rounded lip, the foot of the inside wall.
  const across: Array<[number, number]> = [[width, 0.002], [width * 0.55, depth * 0.45], [width * 0.18, depth * 0.88], [0, depth], [-0.004, depth - 0.006], [-0.007, 0.006]];
  const loops = across.map(([d, lift]) => ({ pts: offset(ring.slice(0, -1), d), lift }));
  const rows = ring.map((_, i) => loops.map(({ pts, lift }) => onCap(end, ...pts[i % pts.length], lift)));
  const bezel = facing(gridGeometry(rows), [end, 0, 0]);
  const back = loops[loops.length - 1].pts;
  return { bezel, mesh: capFill(end, back, MESH_LIFT, rings) };
}

/**
 * A flat panel filling a closed outline on the nose or tail: rings
 * shrinking to its middle, every point laid on the bent face so the
 * panel follows it. UVs are in meters across the face, so textures keep
 * their scale.
 */
export function capFill(end: 1 | -1, outline: Pt[], lift: number, rings: number): THREE.BufferGeometry {
  const mid: Pt = [outline.reduce((s, p) => s + p[0], 0) / outline.length, outline.reduce((s, p) => s + p[1], 0) / outline.length];
  const at = ([z, y]: Pt, t: number): Pt => [z + (mid[0] - z) * t, y + (mid[1] - y) * t];
  const loop = [...outline, outline[0]];
  const grid: Vec3[][] = loop.map((p) => Array.from({ length: rings + 1 }, (_, k) => onCap(end, ...at(p, k / rings), lift)));
  const g = facing(gridGeometry(grid), [end, 0, 0]);
  const uv = g.attributes.uv;
  loop.forEach((p, i) => {
    for (let k = 0; k <= rings; k++) uv.setXY(i * (rings + 1) + k, ...at(p, k / rings));
  });
  return g;

}
