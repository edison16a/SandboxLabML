import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '@/engine/core/rng';
import { STYLE_BRICK, type BuildingSpec } from './layout';

/** Paints a part one flat vertex color. */
function tint(g: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g.index ? g.toNonIndexed() : g;
}

const METAL = new THREE.Color('#9da1a5');
const DUCT = new THREE.Color('#6f7377');
const CONCRETE = new THREE.Color('#8b8780');
const TIMBER = new THREE.Color('#5c4430');
const STEEL = new THREE.Color('#3a3c3f');

/** A wooden water tank on steel legs, the kind brick buildings carry. */
function waterTower(x: number, y: number, h: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(tint(new THREE.CylinderGeometry(0.08, 0.08, 3, 5).translate(x + dx * 1.1, h + 1.5, -(y + dy * 1.1)), STEEL));
  out.push(tint(new THREE.CylinderGeometry(1.6, 1.6, 3.2, 14).translate(x, h + 4.6, -y), TIMBER));
  out.push(tint(new THREE.ConeGeometry(1.75, 1.2, 14).translate(x, h + 6.8, -y), STEEL));
  return out;
}

/**
 * Rooftop plant on every near building: air handling units, a stair
 * housing and now and then a water tank on old brick blocks. It is what
 * makes roofs read as roofs in the top down view.
 */
export function rooftopGeometry(buildings: BuildingSpec[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  buildings.forEach((b, k) => {
    if (b.far) return;
    const rng = new Rng(Math.floor(b.seed * 1e6) + k);
    const inset = b.podium > 0 ? Math.min(5, (b.x1 - b.x0) / 4, (b.y1 - b.y0) / 4) : 0;
    const x0 = b.x0 + inset + 2;
    const x1 = b.x1 - inset - 2;
    const y0 = b.y0 + inset + 2;
    const y1 = b.y1 - inset - 2;
    if (x1 - x0 < 3 || y1 - y0 < 3) return;
    const h = b.height;
    const units = 1 + rng.int(3);
    for (let i = 0; i < units; i++) {
      const w = rng.range(1.6, 3.4);
      const d = rng.range(1.2, 2.4);
      const x = rng.range(x0 + w / 2, x1 - w / 2);
      const y = rng.range(y0 + d / 2, y1 - d / 2);
      parts.push(tint(new THREE.BoxGeometry(w, 1.3, d).translate(x, h + 0.65, -y), METAL));
      parts.push(tint(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 10).translate(x, h + 1.42, -y), DUCT));
    }
    if (rng.chance(0.7)) {
      const x = rng.range(x0 + 1.5, x1 - 1.5);
      const y = rng.range(y0 + 1.5, y1 - 1.5);
      parts.push(tint(new THREE.BoxGeometry(3, 2.6, 3).translate(x, h + 1.3, -y), CONCRETE));
    }
    if (b.style === STYLE_BRICK && rng.chance(0.45) && x1 - x0 > 5 && y1 - y0 > 5) parts.push(...waterTower((x0 + x1) / 2 + rng.range(-1, 1), (y0 + y1) / 2 + rng.range(-1, 1), h));
  });
  if (!parts.length) return new THREE.BufferGeometry();
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}
