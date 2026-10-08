import * as THREE from 'three';
import { CAR, WHEEL_SPOTS } from '../dimensions';
import { buildBody } from './assemble';
import { merge, mirrorZ } from './grid';
import { DETAIL, type Detail, type Slot } from './parts';
import { caliper, buildWheel } from './wheels';

/**
 * How each slot looks on the crowd car: base color, roughness, metalness,
 * glow and tint. Only the paint takes the instance color (tint 1), so the
 * species shows on the body while carbon, glass and tires stay dark.
 */
const LOOK: Record<Slot, { color: [number, number, number]; rough: number; metal: number; glow?: number; tint?: number }> = {
  paint: { color: [1, 1, 1], rough: 0.4, metal: 0.2, tint: 1 },
  carbon: { color: [0.03, 0.032, 0.036], rough: 0.45, metal: 0.1 },
  glass: { color: [0.02, 0.025, 0.032], rough: 0.06, metal: 0.1 },
  trim: { color: [0.02, 0.021, 0.024], rough: 0.55, metal: 0.1 },
  grille: { color: [0.012, 0.012, 0.014], rough: 0.7, metal: 0.2 },
  gold: { color: [0.78, 0.56, 0.3], rough: 0.25, metal: 1 },
  led: { color: [1, 1, 0.95], rough: 0.4, metal: 0, glow: 2.5 },
  tail: { color: [1, 0.08, 0.05], rough: 0.4, metal: 0, glow: 1.6 },
  liner: { color: [0.012, 0.012, 0.013], rough: 0.95, metal: 0 },
  metal: { color: [0.7, 0.72, 0.75], rough: 0.2, metal: 1 },
  tire: { color: [0.02, 0.02, 0.022], rough: 0.9, metal: 0 },
  rim: { color: [0.025, 0.027, 0.03], rough: 0.45, metal: 0.55 },
  disc: { color: [0.2, 0.2, 0.21], rough: 0.5, metal: 0.4 },
  caliper: { color: [0.86, 0.6, 0.12], rough: 0.35, metal: 0.1 },
};

/** Bakes a slot's look into per vertex `color` and `surface` attributes. */
function bake(g: THREE.BufferGeometry, slot: Slot): THREE.BufferGeometry {
  const look = LOOK[slot];
  const n = g.attributes.position.count;
  const color = new Float32Array(n * 3);
  const surface = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    color.set(look.color, i * 3);
    surface.set([look.rough, look.metal, look.glow ?? 0, look.tint ?? 0], i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setAttribute('surface', new THREE.BufferAttribute(surface, 4));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/**
 * The crowd car: the same design built at its lightest detail and merged
 * into one geometry, wheels included, for a single instanced draw call per
 * generation. Pair it with a material passed through withCarSurface.
 * The Low tier passes DETAIL.crowdLow for a lighter build.
 */
export function crowdGeometry(detail: Detail = DETAIL.crowd): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const [slot, g] of buildBody(detail)) parts.push(bake(g, slot));
  const wheel = [...buildWheel(detail), ['caliper', merge([caliper(detail)])] as const];
  for (const [x, z] of WHEEL_SPOTS) {
    for (const [slot, g] of wheel) {
      const placed = (z < 0 ? mirrorZ(g) : g.clone()).translate(x, CAR.wheelRadius, z);
      parts.push(bake(placed, slot));
    }
  }
  wheel.forEach(([, g]) => g.dispose());
  const merged = merge(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}
