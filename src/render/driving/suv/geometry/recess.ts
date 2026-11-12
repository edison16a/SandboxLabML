import type * as THREE from 'three';
import { onCap } from './cap';
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

/**
 * A closed outline with extra points on its long edges, at most `step` m
 * apart. Laid on a curved face, a long straight edge would cut a chord
 * under the paint; short steps keep every part of it on the surface.
 */
export function densify(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    for (let k = 0; k < n; k++) out.push([p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n]);
  });
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

/** Turns a geometry's triangles round if, summed over its vertices, they face away from `dir(position)`. */
export function facing(g: THREE.BufferGeometry, dir: Vec3 | ((p: Vec3) => Vec3)): THREE.BufferGeometry {
  const n = g.attributes.normal;
  const p = g.attributes.position;
  let dot = 0;
  for (let i = 0; i < n.count; i++) {
    const d = typeof dir === 'function' ? dir([p.getX(i), p.getY(i), p.getZ(i)]) : dir;
    dot += n.getX(i) * d[0] + n.getY(i) * d[1] + n.getZ(i) * d[2];
  }
  if (dot >= 0 || !g.index) return g;
  const idx = g.index.array;
  for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  g.index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export interface RecessShape {
  /** Width of the bezel on the paint outside the opening, m. */
  width: number;
  /** How far the bezel's rounded lip stands proud of the face, m. */
  lip: number;
  /** How far behind the face the mesh sits, m; only where the face has a hole for it may this go past zero. */
  back: number;
}

export interface Recess {
  /** The gloss black bezel: from the paint up to a rounded lip and back down to the face. */
  bezel: THREE.BufferGeometry;
  /** The walls inside the opening, from the face back to the mesh. */
  throat: THREE.BufferGeometry;
  /** The mesh filling the back of the opening. */
  mesh: THREE.BufferGeometry;
}

/**
 * An intake on the nose or tail. The bezel's outer edge lies on the
 * paint outside the opening and rises to a rounded lip, which catches a
 * line of light; inside, the throat drops back to the mesh. Where the
 * face has a hole the mesh sits well behind the paint, so from any angle
 * but dead ahead the throat shows and the opening has real depth.
 * `outline` is counterclockwise in (z, y), in the face's own unrolled
 * coordinates, so an intake can wrap onto a corner.
 */
export function recess(end: 1 | -1, corners: Pt[], shape: RecessShape, rings: number, step = 0.015, meshStep = step): Recess {
  const { width, lip, back } = shape;
  const outline = densify(corners, step);
  const build = (across: Array<[number, number]>) => ringGeometry(end, corners, across, step);
  const bezel = facing(build([[width, 0.002], [width * 0.55, lip * 0.75], [width * 0.18, lip], [0, lip * 0.8], [-0.003, 0.002]]), [end, 0, 0]);
  const deep = -Math.max(back, -0.002);
  const throat = build([[-0.003, 0.002], [-0.004, deep * 0.4], [-0.005, deep]]);
  const mid: Pt = [outline.reduce((s, p) => s + p[0], 0) / outline.length, outline.reduce((s, p) => s + p[1], 0) / outline.length];
  const centre = onCap(end, mid[0], mid[1], deep);
  // The throat's walls face into the opening.
  facing(throat, (p) => [centre[0] - p[0], centre[1] - p[1], centre[2] - p[2]]);
  return { bezel, throat, mesh: capFill(end, offset(corners, -0.005), deep + 0.001, rings, meshStep) };
}

/**
 * A band round a closed outline on the nose or tail: each entry of
 * `across` is a loop, the outline moved out by d m and lifted off the
 * face by lift m, and the band runs through the loops in order. Bezels,
 * throats and raised frames are all such bands.
 */
export function ringGeometry(end: 1 | -1, corners: Pt[], across: Array<[number, number]>, step: number): THREE.BufferGeometry {
  const outline = densify(corners, step);
  const loops = across.map(([d, lift]) => ({ pts: offset(outline, d), lift }));
  return gridGeometry([...outline, outline[0]].map((_, i) => loops.map(({ pts, lift }) => onCap(end, ...pts[i % pts.length], lift))));
}

/**
 * A band like ringGeometry, split by where it runs: the steps whose two
 * outline points both pass `pick` go in the first list, the rest in the
 * second, each as open strips. A frame can then change material along
 * its length, say black where it sits on the dark lower bumper.
 */
export function ringSplit(end: 1 | -1, corners: Pt[], across: Array<[number, number]>, step: number, pick: (p: Pt) => boolean): [THREE.BufferGeometry[], THREE.BufferGeometry[]] {
  const outline = densify(corners, step);
  const n = outline.length;
  const loops = across.map(([d, lift]) => ({ pts: offset(outline, d), lift }));
  const row = (i: number) => loops.map(({ pts, lift }) => onCap(end, ...pts[i % n], lift));
  const picked = (i: number) => pick(outline[i % n]) && pick(outline[(i + 1) % n]);
  // Start the walk where the kind of step changes, so no strip wraps past the end of the loop.
  const start = Array.from({ length: n }, (_, i) => i).find((i) => picked(i) !== picked(i + n - 1)) ?? 0;
  const out: [THREE.BufferGeometry[], THREE.BufferGeometry[]] = [[], []];
  let strip: Vec3[][] = [row(start)];
  for (let k = 0; k < n; k++) {
    const i = start + k;
    strip.push(row(i + 1));
    if (k === n - 1 || picked(i + 1) !== picked(i)) {
      out[picked(i) ? 0 : 1].push(gridGeometry(strip));
      strip = [row(i + 1)];
    }
  }
  return out;
}

/**
 * A flat panel filling a closed outline on the nose or tail: rings
 * shrinking to its middle, every point laid on the bent face so the
 * panel follows it. UVs are in meters across the face, so textures keep
 * their scale.
 */
export function capFill(end: 1 | -1, corners: Pt[], lift: number, rings: number, step = 0.02): THREE.BufferGeometry {
  const outline = densify(corners, step);
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
