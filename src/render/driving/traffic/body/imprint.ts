import * as THREE from 'three';
import type { Vec3 } from '../../suv/geometry/grid';
import { bakeLook, LAMP, type Look } from '../looks';
import type { View } from '../shape/types';
import type { Projector } from './project';
import type { Pt } from './section';

/** Barycentric coordinates in one shell triangle. */
type Bary = [number, number, number];

/** A convex piece of a shell triangle, with the look stamped on it last. */
interface Piece {
  poly: Bary[];
  look: Look;
  lamp: number;
}

interface Tri {
  p: Vec3[];
  n: Vec3[];
  face: Vec3;
  pieces: Piece[];
}

/** A view's plane axes, the axis it looks along, and which way along it faces the viewer. */
const AXES: Record<View, { u: number; v: number; w: number; s: number }> = {
  side: { u: 0, v: 1, w: 2, s: 1 },
  top: { u: 0, v: 2, w: 1, s: 1 },
  front: { u: 2, v: 1, w: 0, s: 1 },
  rear: { u: 2, v: 1, w: 0, s: -1 },
};

const EPS = 1e-9;

/** Even odd test of a point against a closed loop. */
function inside(p: Pt, loop: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [ax, ay] = loop[i];
    const [bx, by] = loop[j];
    if (ay > p[1] !== by > p[1] && p[0] < ((bx - ax) * (p[1] - ay)) / (by - ay) + ax) hit = !hit;
  }
  return hit;
}

/**
 * Paints glass, lamps, grilles and lines straight onto the body shell.
 * Each outline, drawn in a flat view, splits the shell triangles under it
 * along its edges; the pieces inside take its look. Nothing floats above
 * the paint, so nothing can poke through or flicker, the outlines stay
 * crisp whatever the shell's density, and every piece keeps the shell's
 * smooth normals. Later stamps win, so a pillar can sit on the glass.
 */
export class Imprint {
  private readonly tris: Tri[] = [];

  /** Adds a shell part with its base look. Zero area triangles are dropped. */
  add(g: THREE.BufferGeometry, look: Look): void {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const count = g.index ? g.index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map((k) => (g.index ? g.index.getX(i + k) : i + k));
      const p = ids.map((k) => [pos.getX(k), pos.getY(k), pos.getZ(k)] as Vec3);
      const e1 = new THREE.Vector3(...p[1]).sub(new THREE.Vector3(...p[0]));
      const e2 = new THREE.Vector3(...p[2]).sub(new THREE.Vector3(...p[0]));
      const f = e1.cross(e2);
      if (f.length() < 1e-10) continue;
      f.normalize();
      this.tris.push({ p, n: ids.map((k) => [nrm.getX(k), nrm.getY(k), nrm.getZ(k)] as Vec3), face: [f.x, f.y, f.z], pieces: [{ poly: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], look, lamp: LAMP.none }] });
    }
  }

  /**
   * Stamps a closed outline seen from `view` onto the shell. Only pieces
   * the view actually sees take the look: a piece must face the viewer and
   * be the first surface `proj` meets along its ray, so a rear lamp drawn
   * from behind never lands on a door that happens to lean back a little.
   */
  stamp(loop: Pt[], view: View, look: Look, lamp: number, proj: Projector): void {
    const { u, v, w, s } = AXES[view];
    const box = bounds(loop);
    const edges = loop.map((a, i) => ({ a, b: loop[(i + 1) % loop.length], box: bounds([a, loop[(i + 1) % loop.length]]) }));
    for (const t of this.tris) {
      if (t.face[w] * s <= 1e-4) continue;
      const tu = t.p.map((q) => q[u]);
      const tv = t.p.map((q) => q[v]);
      const tb = bounds(tu.map((x, k) => [x, tv[k]] as Pt));
      if (!overlap(tb, box)) continue;
      const flat = (b: Bary): Pt => [b[0] * tu[0] + b[1] * tu[1] + b[2] * tu[2], b[0] * tv[0] + b[1] * tv[1] + b[2] * tv[2]];
      let pieces = t.pieces;
      for (const e of edges) {
        if (!overlap(e.box, tb)) continue;
        pieces = pieces.flatMap((pc) => split(pc, e.a, e.b, e.box, flat));
      }
      for (const pc of pieces) {
        const c = pc.poly.reduce<Pt>((acc, b) => { const q = flat(b); return [acc[0] + q[0] / pc.poly.length, acc[1] + q[1] / pc.poly.length]; }, [0, 0]);
        if (inside(c, loop) && seen(t, pc, view, proj)) {
          pc.look = look;
          pc.lamp = lamp;
        }
      }
      t.pieces = pieces;
    }
  }

  /** The stamped shell as one geometry, looks baked per vertex. */
  geometry(): THREE.BufferGeometry {
    const pos: number[] = [];
    const nrm: number[] = [];
    const looks: Look[] = [];
    const lamps: number[] = [];
    for (const t of this.tris) {
      for (const pc of t.pieces) {
        for (let i = 1; i < pc.poly.length - 1; i++) {
          for (const b of [pc.poly[0], pc.poly[i], pc.poly[i + 1]]) {
            const n = [0, 1, 2].map((k) => b[0] * t.n[0][k] + b[1] * t.n[1][k] + b[2] * t.n[2][k]);
            const len = Math.hypot(n[0], n[1], n[2]) || 1;
            for (let k = 0; k < 3; k++) pos.push(b[0] * t.p[0][k] + b[1] * t.p[1][k] + b[2] * t.p[2][k]);
            nrm.push(n[0] / len, n[1] / len, n[2] / len);
            looks.push(pc.look);
            lamps.push(pc.lamp);
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return bakeLook(g, looks, lamps);
  }
}

/** Whether the middle of a piece is the first surface its view's ray meets there. */
function seen(t: Tri, pc: Piece, view: View, proj: Projector): boolean {
  const { u, v, w } = AXES[view];
  const c = [0, 1, 2].map((k) => pc.poly.reduce((acc, b) => acc + (b[0] * t.p[0][k] + b[1] * t.p[1][k] + b[2] * t.p[2][k]) / pc.poly.length, 0));
  const hit = proj.hit(view, c[u], c[v]);
  return !hit || Math.abs(hit.p[w] - c[w]) < 0.02;
}

type Box = [number, number, number, number];

function bounds(pts: Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

const overlap = (a: Box, b: Box) => a[0] <= b[2] + EPS && b[0] <= a[2] + EPS && a[1] <= b[3] + EPS && b[1] <= a[3] + EPS;

/** Splits a convex piece by the line through a and b, if that line crosses it near the segment. */
function split(pc: Piece, a: Pt, b: Pt, segBox: Box, flat: (b: Bary) => Pt): Piece[] {
  const pts = pc.poly.map(flat);
  if (!overlap(bounds(pts), segBox)) return [pc];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = pts.map(([x, y]) => dx * (y - a[1]) - dy * (x - a[0]));
  const len2 = dx * dx + dy * dy;
  const scale = Math.sqrt(len2) * 1e-7;
  if (d.every((x) => x >= -scale) || d.every((x) => x <= scale)) return [pc];
  // Only cut where the segment itself crosses the piece, not just its line.
  let t0 = Infinity;
  let t1 = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    if (d[i] > 0 === d[j] > 0) continue;
    const f = d[i] / (d[i] - d[j] || 1);
    const t = ((pts[i][0] + (pts[j][0] - pts[i][0]) * f - a[0]) * dx + (pts[i][1] + (pts[j][1] - pts[i][1]) * f - a[1]) * dy) / len2;
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
  }
  if (t1 < -1e-6 || t0 > 1 + 1e-6) return [pc];
  const left: Bary[] = [];
  const right: Bary[] = [];
  const n = pc.poly.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (d[i] >= -scale) left.push(pc.poly[i]);
    if (d[i] <= scale) right.push(pc.poly[i]);
    if ((d[i] > scale && d[j] < -scale) || (d[i] < -scale && d[j] > scale)) {
      const t = d[i] / (d[i] - d[j]);
      const p = pc.poly[i];
      const q = pc.poly[j];
      const m: Bary = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      left.push(m);
      right.push(m);
    }
  }
  return [left, right].filter((poly) => poly.length >= 3).map((poly) => ({ poly, look: pc.look, lamp: pc.lamp }));
}
