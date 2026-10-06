import * as THREE from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { onBody, onCap } from './body';
import { sectionAt } from './bodyProfile';
import { bowed } from './curve';
import { gridGeometry, type Vec3 } from './grid';

export type Pt = [number, number];

/**
 * Shape and strip makers for one end of the car at a level of detail. The
 * crowd car's faces are coarse, so its decals are diced less and stand
 * further off to stay clear of the flatter surface under them.
 */
export function capDecals(end: 1 | -1, fine: boolean) {
  const k = fine ? 1 : 2.5;
  const dice = fine ? 0.04 : 0.25;
  return {
    shape: (pts: Pt[], lift: number) => capShape(end, pts, lift * k, dice),
    strip: (a: Pt, b: Pt, width: number, lift: number) => capStrip(end, a, b, width, lift * k, dice),
  };
}

/**
 * A flat shape laid on the nose (+1) or tail (-1) face, drawn as (z, y)
 * points. The shape is diced into small triangles before it is bent onto
 * the face, so it hugs the curve instead of cutting through it.
 */
export function capShape(end: 1 | -1, pts: Pt[], lift = 0.004, fineness = 0.04): THREE.BufferGeometry {
  const flat = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))));
  const g = new TessellateModifier(fineness, 6).modify(flat);
  flat.dispose();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, ...onCap(end, p.getX(i), p.getY(i), lift));
  g.computeVertexNormals();
  // The drawing plane maps to the face mirrored for one end; turn the triangles round if they face in.
  if (g.attributes.normal.getX(0) * end < 0) flipWinding(g);
  return g;
}

/** A straight strip on the nose or tail face from `a` to `b`, `width` meters across. */
export function capStrip(end: 1 | -1, a: Pt, b: Pt, width: number, lift = 0.005, fineness = 0.03): THREE.BufferGeometry {
  const d = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
  const n: Pt = [(-d.y * width) / 2, (d.x * width) / 2];
  return capShape(end, [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], lift, fineness);
}

function flipWinding(g: THREE.BufferGeometry): void {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < a.itemSize; k++) {
        const t = a.getComponent(i + 1, k);
        a.setComponent(i + 1, k, a.getComponent(i + 2, k));
        a.setComponent(i + 2, k, t);
      }
    }
  }
  g.computeVertexNormals();
}

/** Length of a body band at x, for turning a width in meters into a fraction of the band. */
export function bandLength(x: number, band: number): number {
  const s = sectionAt(x);
  const pts = bowed(s.keys[band], s.keys[band + 1], s.bulge[band], 24);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/**
 * A patch that follows one body band: rows from x0 to x1, each spanning the
 * band from fraction t0(x) to t1(x). `lean` slides the top of the patch
 * along x by that many meters, for edges that rake back. Intakes and
 * stripes are all patches like this, lifted a few millimeters off the paint.
 */
export function bandPatch(band: number, x0: number, x1: number, t0: (x: number) => number, t1: (x: number) => number, rows: number, cols: number, lift: number, lean = 0): THREE.BufferGeometry {
  const grid: Vec3[][] = [];
  for (let i = 0; i <= rows; i++) {
    const x = x0 + ((x1 - x0) * i) / rows;
    const a = t0(x);
    const b = t1(x);
    grid.push(Array.from({ length: cols + 1 }, (_, j) => onBody(x + (lean * j) / cols, band, a + ((b - a) * j) / cols, lift)));
  }
  return gridGeometry(grid);
}

/** A stripe of fixed width along the top (or bottom) edge of a band, hugging the crease there. */
export function creaseStripe(band: number, edge: 'top' | 'bottom', x0: number, x1: number, width: number, rows: number, lift = 0.002): THREE.BufferGeometry {
  const near = (x: number) => Math.min(1, width / bandLength(x, band));
  return edge === 'top' ? bandPatch(band, x0, x1, (x) => 1 - near(x), () => 1, rows, 1, lift) : bandPatch(band, x0, x1, () => 0, near, rows, 1, lift);
}
