import type * as THREE from 'three';
import type { Vec3 } from '../../suv/geometry/grid';
import type { View } from '../shape/types';

/** Which world axes a view's 2D coordinates are, the axis its rays run along, and whether the nearest hit is the largest coordinate. */
const AXES: Record<View, { u: number; v: number; w: number; max: boolean }> = {
  side: { u: 0, v: 1, w: 2, max: true },
  top: { u: 0, v: 2, w: 1, max: true },
  front: { u: 2, v: 1, w: 0, max: true },
  rear: { u: 2, v: 1, w: 0, max: false },
};

const CELLS = 40;

/** A uniform grid over one view's plane, listing the triangles that cover each cell. */
interface Buckets {
  min: [number, number];
  size: [number, number];
  cells: number[][];
}

export interface Hit {
  p: Vec3;
  n: Vec3;
}

/**
 * Lays points onto the body by casting straight rays from outside along
 * a view's axis and keeping the first surface met. Decals are drawn in a
 * flat view and projected this way, so they hug whatever the loft made,
 * lean and arches included. Triangles are bucketed per view, so each ray
 * only tests the few under it.
 */
export class Projector {
  private readonly pos: Float32Array;
  private readonly nrm: Float32Array;
  private readonly buckets = new Map<View, Buckets>();

  constructor(parts: THREE.BufferGeometry[]) {
    const pos: number[] = [];
    const nrm: number[] = [];
    for (const g of parts) {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const count = g.index ? g.index.count : p.count;
      for (let i = 0; i < count; i++) {
        const k = g.index ? g.index.getX(i) : i;
        pos.push(p.getX(k), p.getY(k), p.getZ(k));
        nrm.push(n.getX(k), n.getY(k), n.getZ(k));
      }
    }
    this.pos = new Float32Array(pos);
    this.nrm = new Float32Array(nrm);
  }

  private bucketsFor(view: View): Buckets {
    const cached = this.buckets.get(view);
    if (cached) return cached;
    const { u, v } = AXES[view];
    const p = this.pos;
    const tris = p.length / 9;
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      u0 = Math.min(u0, p[i + u]);
      u1 = Math.max(u1, p[i + u]);
      v0 = Math.min(v0, p[i + v]);
      v1 = Math.max(v1, p[i + v]);
    }
    const b: Buckets = { min: [u0, v0], size: [(u1 - u0) / CELLS + 1e-9, (v1 - v0) / CELLS + 1e-9], cells: Array.from({ length: CELLS * CELLS }, () => []) };
    for (let t = 0; t < tris; t++) {
      const o = t * 9;
      const cu = [p[o + u], p[o + 3 + u], p[o + 6 + u]].map((x) => Math.floor((x - u0) / b.size[0]));
      const cv = [p[o + v], p[o + 3 + v], p[o + 6 + v]].map((x) => Math.floor((x - v0) / b.size[1]));
      for (let i = Math.max(0, Math.min(...cu)); i <= Math.min(CELLS - 1, Math.max(...cu)); i++) {
        for (let j = Math.max(0, Math.min(...cv)); j <= Math.min(CELLS - 1, Math.max(...cv)); j++) b.cells[j * CELLS + i].push(t);
      }
    }
    this.buckets.set(view, b);
    return b;
  }

  /** The first surface point a ray meets at (a, b) in the view's plane, with its smooth normal, or null if it misses. */
  hit(view: View, a: number, b: number): Hit | null {
    const { u, v, w, max } = AXES[view];
    const bk = this.bucketsFor(view);
    const i = Math.floor((a - bk.min[0]) / bk.size[0]);
    const j = Math.floor((b - bk.min[1]) / bk.size[1]);
    if (i < 0 || j < 0 || i >= CELLS || j >= CELLS) return null;
    const p = this.pos;
    let best = -1;
    let depth = max ? -Infinity : Infinity;
    let l0 = 0, l1 = 0, l2 = 0;
    for (const t of bk.cells[j * CELLS + i]) {
      const o = t * 9;
      const ax = p[o + u], ay = p[o + v];
      const bx = p[o + 3 + u] - ax, by = p[o + 3 + v] - ay;
      const cx = p[o + 6 + u] - ax, cy = p[o + 6 + v] - ay;
      const det = bx * cy - by * cx;
      if (Math.abs(det) < 1e-12) continue;
      const px = a - ax, py = b - ay;
      const s = (px * cy - py * cx) / det;
      const r = (bx * py - by * px) / det;
      if (s < -1e-7 || r < -1e-7 || s + r > 1 + 1e-7) continue;
      const d = (1 - s - r) * p[o + w] + s * p[o + 3 + w] + r * p[o + 6 + w];
      if (max ? d > depth : d < depth) {
        depth = d;
        best = t;
        l0 = 1 - s - r;
        l1 = s;
        l2 = r;
      }
    }
    if (best < 0) return null;
    const o = best * 9;
    const n = this.nrm;
    const out: Vec3 = [0, 0, 0];
    const nn: Vec3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      out[k] = l0 * p[o + k] + l1 * p[o + 3 + k] + l2 * p[o + 6 + k];
      nn[k] = l0 * n[o + k] + l1 * n[o + 3 + k] + l2 * n[o + 6 + k];
    }
    const len = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    return { p: out, n: [nn[0] / len, nn[1] / len, nn[2] / len] };
  }
}
