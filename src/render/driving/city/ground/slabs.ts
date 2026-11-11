import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CURB_RADIUS } from '@/engine/driving/city/dimensions';
import type { City } from '@/engine/driving/city/types';

/** Curb height above the road, m, and how wide the curb stone's top is. */
export const CURB_HEIGHT = 0.15;
export const CURB_TOP = 0.24;
/** How far past the grid the outer sidewalk and plaza run, m. */
export const OUTER_MARGIN = 260;

/** A rounded rectangle outline in sim coordinates, counterclockwise. */
function rounded(path: THREE.Path, x0: number, x1: number, y0: number, y1: number, r: number, clockwise = false): THREE.Path {
  if (!clockwise) {
    path.moveTo(x0 + r, y0);
    path.lineTo(x1 - r, y0);
    path.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
    path.lineTo(x1, y1 - r);
    path.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
    path.lineTo(x0 + r, y1);
    path.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
    path.lineTo(x0, y0 + r);
    path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  } else {
    path.moveTo(x0 + r, y0);
    path.absarc(x0 + r, y0 + r, r, Math.PI * 1.5, Math.PI, true);
    path.lineTo(x0, y1 - r);
    path.absarc(x0 + r, y1 - r, r, Math.PI, Math.PI / 2, true);
    path.lineTo(x1 - r, y1);
    path.absarc(x1 - r, y1 - r, r, Math.PI / 2, 0, true);
    path.lineTo(x1, y0 + r);
    path.absarc(x1 - r, y0 + r, r, 0, -Math.PI / 2, true);
  }
  return path;
}

/** Lays a shape built in sim coordinates flat on the ground: sim (x, y) to world (x, h, -y), extrusion upward. */
function layFlat(g: THREE.BufferGeometry, height: number): THREE.BufferGeometry {
  return g.rotateX(-Math.PI / 2).translate(0, height, 0);
}

/**
 * The raised parts of the street: a curb stone ring round every block and
 * round the outside of the grid, and the sidewalk tops inside them. The
 * sidewalk tops carry UVs in meters so the paving tiles keep their size.
 */
export function slabGeometry(city: City): { curbs: THREE.BufferGeometry; walks: THREE.BufferGeometry } {
  const curbs: THREE.BufferGeometry[] = [];
  const walks: THREE.BufferGeometry[] = [];
  const steps = 10;
  const bevel = { depth: CURB_HEIGHT - 0.02, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: steps };
  for (const k of city.blocks) {
    const ring = rounded(new THREE.Shape(), k.x0, k.x1, k.y0, k.y1, CURB_RADIUS) as THREE.Shape;
    ring.holes.push(rounded(new THREE.Path(), k.x0 + CURB_TOP, k.x1 - CURB_TOP, k.y0 + CURB_TOP, k.y1 - CURB_TOP, CURB_RADIUS - CURB_TOP, true));
    curbs.push(layFlat(new THREE.ExtrudeGeometry(ring, bevel), 0));
    const top = rounded(new THREE.Shape(), k.x0 + CURB_TOP - 0.01, k.x1 - CURB_TOP + 0.01, k.y0 + CURB_TOP - 0.01, k.y1 - CURB_TOP + 0.01, CURB_RADIUS - CURB_TOP) as THREE.Shape;
    walks.push(layFlat(new THREE.ShapeGeometry(top, steps), CURB_HEIGHT - 0.002));
  }
  // The outside of the grid: a square cornered curb facing in, and sidewalk out to the far plaza.
  const b = city.bounds;
  const outer = new THREE.Shape().moveTo(b.minX - CURB_TOP, b.minY - CURB_TOP).lineTo(b.maxX + CURB_TOP, b.minY - CURB_TOP).lineTo(b.maxX + CURB_TOP, b.maxY + CURB_TOP).lineTo(b.minX - CURB_TOP, b.maxY + CURB_TOP);
  outer.holes.push(new THREE.Path().moveTo(b.minX, b.minY).lineTo(b.minX, b.maxY).lineTo(b.maxX, b.maxY).lineTo(b.maxX, b.minY));
  curbs.push(layFlat(new THREE.ExtrudeGeometry(outer, bevel), 0));
  const m = OUTER_MARGIN;
  const plaza = new THREE.Shape().moveTo(b.minX - m, b.minY - m).lineTo(b.maxX + m, b.minY - m).lineTo(b.maxX + m, b.maxY + m).lineTo(b.minX - m, b.maxY + m);
  plaza.holes.push(new THREE.Path().moveTo(b.minX - CURB_TOP + 0.01, b.minY - CURB_TOP + 0.01).lineTo(b.minX - CURB_TOP + 0.01, b.maxY + CURB_TOP - 0.01).lineTo(b.maxX + CURB_TOP - 0.01, b.maxY + CURB_TOP - 0.01).lineTo(b.maxX + CURB_TOP - 0.01, b.minY - CURB_TOP + 0.01));
  walks.push(layFlat(new THREE.ShapeGeometry(plaza, 1), CURB_HEIGHT - 0.002));
  const out = { curbs: merge(curbs), walks: merge(walks) };
  curbs.concat(walks).forEach((g) => g.dispose());
  return out;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ready = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    g.clearGroups();
    return g;
  });
  const merged = mergeGeometries(ready) as THREE.BufferGeometry;
  ready.forEach((g, i) => g !== parts[i] && g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** The asphalt: one plane under the whole grid, UVs in meters. */
export function asphaltGeometry(city: City): THREE.BufferGeometry {
  const b = city.bounds;
  const w = b.maxX - b.minX + 2;
  const h = b.maxY - b.minY + 2;
  const g = new THREE.PlaneGeometry(w, h, 1, 1).rotateX(-Math.PI / 2).translate((b.minX + b.maxX) / 2, 0, -(b.minY + b.maxY) / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
  return g;
}
