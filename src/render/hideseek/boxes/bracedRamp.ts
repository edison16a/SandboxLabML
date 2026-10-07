import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BoxSize } from '@/engine/hideseek/physics';
import { bar, BRACE, BRACE_DEPTH, EDGE, type BracedBoxParts } from './bracedBox';
import { panelApex, rampShape } from './rampShape';

/** Grip tread width along the slope and height above it, m: low enough to read as grip, not as steps. */
const TREAD = 0.05;
const TREAD_RISE = 0.028;

/**
 * A ramp in the crate kit: lacquered panels under a light frame. The slope
 * is a flat panel crossed by raised grip treads; the high back face and
 * the high half of each side are shallow pyramids braced along their
 * ridges, like every crate face. Panels come back as one mesh and the
 * frame, braces and treads as another, so locking lights them exactly as
 * it lights a crate.
 */
export function bracedRamp(s: BoxSize): BracedBoxParts {
  const shape = rampShape(s);
  const tris: number[] = [];
  const bars: THREE.BufferGeometry[] = [];
  const push = (...ps: THREE.Vector3[]) => ps.forEach((p) => tris.push(p.x, p.y, p.z));
  for (const p of [shape.slope, ...shape.plain]) for (let i = 1; i + 1 < p.ring.length; i++) push(p.ring[0], p.ring[i], p.ring[i + 1]);
  for (const p of shape.panels) {
    const apex = panelApex(p);
    for (let i = 0; i < p.ring.length; i++) {
      push(p.ring[i], p.ring[(i + 1) % p.ring.length], apex);
      bars.push(bar(p.ring[i], apex, p.n, BRACE, BRACE_DEPTH));
    }
  }
  for (const e of shape.posts) bars.push(bar(e.a, e.b, e.n, BRACE, BRACE_DEPTH));
  for (const e of shape.edges) bars.push(bar(e.a, e.b, e.n, EDGE, EDGE));
  // Treads sit on the slope, raised by half their height so their bottoms touch it.
  for (const t of shape.treads) bars.push(bar(t.a.clone().addScaledVector(t.n, TREAD_RISE / 2), t.b.clone().addScaledVector(t.n, TREAD_RISE / 2), t.n, TREAD, TREAD_RISE));
  const panels = new THREE.BufferGeometry();
  panels.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  panels.computeVertexNormals();
  const merged = mergeGeometries(bars) as THREE.BufferGeometry;
  bars.forEach((g) => g.dispose());
  return { panels, braces: merged };
}
