import * as THREE from 'three';
import { CROSSWALK_FAR, CROSSWALK_NEAR, CURB_RADIUS, DIR_X, DIR_Y, ROAD_HALF, STOP_LINE } from '@/engine/driving/city/dimensions';
import type { City, CityNode } from '@/engine/driving/city/types';

/** Paint sits this far above the asphalt, m: enough to never flicker, too little to see. */
export const PAINT_LIFT = 0.006;

/**
 * Collects flat quads on the road in sim coordinates. Each quad gets UVs
 * of (meters along, 0 to 1 across), so the paint shader can wear edges and
 * fade tire tracks without any texture.
 */
class Quads {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  readonly index: number[] = [];

  /** A strip from (x0, y0) to (x1, y1), `w` wide. */
  strip(x0: number, y0: number, x1: number, y1: number, w: number): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-3) return;
    const nx = (-(y1 - y0) / len) * (w / 2);
    const ny = ((x1 - x0) / len) * (w / 2);
    const k = this.pos.length / 3;
    const corners = [
      [x0 - nx, y0 - ny, 0, 0],
      [x1 - nx, y1 - ny, len, 0],
      [x1 + nx, y1 + ny, len, 1],
      [x0 + nx, y0 + ny, 0, 1],
    ];
    for (const [x, y, u, v] of corners) {
      this.pos.push(x, PAINT_LIFT, -y);
      this.uv.push(u, v);
    }
    this.index.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}

/** Where paint along an arm of a node starts: past the crossing, or past the curb corner where there is none. */
function clearOf(node: CityNode): number {
  return node.signal >= 0 ? CROSSWALK_FAR + 0.6 : ROAD_HALF + CURB_RADIUS + 0.5;
}

/** Lines along one street segment from node a to node b (one step east or north). */
function segment(q: Quads, a: CityNode, b: CityNode, d: 0 | 1): void {
  const dx = DIR_X[d];
  const dy = DIR_Y[d];
  const px = -dy;
  const py = dx;
  const s0 = clearOf(a);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const s1 = len - clearOf(b);
  const at = (s: number, lat: number): [number, number] => [a.x + dx * s + px * lat, a.y + dy * s + py * lat];
  // Edge lines, a little in from each curb.
  for (const lat of [ROAD_HALF - 0.32, -(ROAD_HALF - 0.32)]) q.strip(...at(s0, lat), ...at(s1, lat), 0.12);
  // Center line: solid for the last stretch into each junction, dashed between.
  const solid = 16;
  const lo = Math.min(s0 + solid, (s0 + s1) / 2);
  const hi = Math.max(s1 - solid, (s0 + s1) / 2);
  q.strip(...at(s0, 0), ...at(lo, 0), 0.14);
  q.strip(...at(hi, 0), ...at(s1, 0), 0.14);
  const span = hi - lo;
  const dashes = Math.max(1, Math.round(span / 8));
  const step = span / dashes;
  for (let k = 0; k < dashes; k++) q.strip(...at(lo + k * step + step * 0.3, 0), ...at(lo + k * step + step * 0.3 + 3, 0), 0.14);
}

/** Stop lines and zebra crossings on every arm of a signalized node. */
function junction(q: Quads, n: CityNode): void {
  if (n.signal < 0) return;
  for (let a = 0; a < 4; a++) {
    if (!n.arms[a]) continue;
    const dx = DIR_X[a];
    const dy = DIR_Y[a];
    // Facing into the node from this arm, the arriving lane is on the left of the arm's outward direction.
    const px = -dy;
    const py = dx;
    const at = (s: number, lat: number): [number, number] => [n.x + dx * s + px * lat, n.y + dy * s + py * lat];
    q.strip(...at(STOP_LINE - 0.45, 0.08), ...at(STOP_LINE - 0.45, ROAD_HALF - 0.1), 0.42);
    for (let k = -3; k <= 3; k++) q.strip(...at(CROSSWALK_NEAR, k), ...at(CROSSWALK_FAR, k), 0.5);
  }
}

/**
 * All the paint on the streets: dashed and solid center lines, edge lines,
 * stop lines across the arriving lane at every signal, and a zebra crossing
 * on every arm of a signalized junction.
 */
export function markingGeometry(city: City): THREE.BufferGeometry {
  const q = new Quads();
  const nx = city.xs.length;
  for (const n of city.nodes) {
    if (n.arms[0]) segment(q, n, city.nodes[n.id + 1], 0);
    if (n.arms[1]) segment(q, n, city.nodes[n.id + nx], 1);
    junction(q, n);
  }
  return q.build();
}

/**
 * Darker, smoother asphalt where tires run: two soft tracks down the middle
 * of every lane. Drawn as quads the paint shader fades at their edges.
 */
export function wearGeometry(city: City): THREE.BufferGeometry {
  const q = new Quads();
  for (let i = 0; i < city.laneCount; i++) {
    const p = city.elements[i].path;
    const n = p.n - 1;
    for (const side of [-0.82, 0.82]) {
      const ox = -p.ty[0] * side;
      const oy = p.tx[0] * side;
      q.strip(p.x[0] + ox, p.y[0] + oy, p.x[n] + ox, p.y[n] + oy, 0.7);
    }
  }
  return q.build();
}
