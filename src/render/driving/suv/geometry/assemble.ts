import * as THREE from 'three';
import { WHEEL_SPOTS, WHEEL } from '../dimensions';
import { addArches, addUnderbody } from './arches';
import { addBody } from './body';
import { addCabin } from './cabin';
import { addFront, addRear } from './ends';
import { merge, mirrorZ } from './grid';
import { DETAIL, PartBin, type Detail, type Slot } from './parts';
import { addSides } from './sides';
import { addSunroof, addWindows } from './windows';
import { buildWheel, caliper } from './wheels';

/**
 * Every part of the SUV that rides on the suspension, merged by material
 * slot. Wheels are built separately because they spin and steer.
 */
export function buildBody(detail: Detail): Map<Slot, THREE.BufferGeometry> {
  const bin = new PartBin();
  addBody(bin, detail);
  addArches(bin, detail);
  addUnderbody(bin);
  addCabin(bin, detail);
  addFront(bin, detail);
  addRear(bin, detail);
  addSides(bin, detail);
  addWindows(bin, detail);
  addSunroof(bin, detail);
  return bin.build();
}

/** How each slot looks on the population SUV: base color, roughness, metalness, glow and tint. */
const LOOK: Record<Slot, { color: [number, number, number]; rough: number; metal: number; glow?: number; tint?: number }> = {
  paint: { color: [1, 1, 1], rough: 0.35, metal: 0.3, tint: 1 },
  glass: { color: [0.02, 0.025, 0.03], rough: 0.05, metal: 0.2 },
  trim: { color: [0.012, 0.012, 0.014], rough: 0.2, metal: 0.2 },
  clad: { color: [0.03, 0.031, 0.033], rough: 0.6, metal: 0 },
  grille: { color: [0.01, 0.01, 0.012], rough: 0.5, metal: 0.2 },
  led: { color: [1, 1, 0.96], rough: 0.4, metal: 0, glow: 3 },
  tail: { color: [1, 0.06, 0.04], rough: 0.4, metal: 0, glow: 1.5 },
  liner: { color: [0.012, 0.012, 0.013], rough: 0.95, metal: 0 },
  metal: { color: [0.7, 0.72, 0.75], rough: 0.2, metal: 1 },
  tire: { color: [0.02, 0.02, 0.022], rough: 0.9, metal: 0 },
  rim: { color: [0.52, 0.53, 0.55], rough: 0.3, metal: 0.9 },
  disc: { color: [0.25, 0.25, 0.26], rough: 0.5, metal: 0.5 },
  caliper: { color: [0.75, 0.1, 0.08], rough: 0.35, metal: 0.1 },
};

/** Bakes a slot's look into per vertex `color` and `surface` attributes, for one instanced draw call. */
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
 * The population SUV: the same design at its lightest detail, wheels
 * included, merged into one geometry for one instanced draw call. Pair it
 * with a material passed through withCarSurface.
 */
export function crowdSuvGeometry(detail: Detail = DETAIL.crowd): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const [slot, g] of buildBody(detail)) parts.push(bake(g, slot));
  const wheel = [...buildWheel(detail), ['caliper', merge([caliper(detail)])] as const];
  for (const [x, z] of WHEEL_SPOTS) {
    for (const [slot, g] of wheel) parts.push(bake((z < 0 ? mirrorZ(g) : g.clone()).translate(x, WHEEL.radius, z), slot));
  }
  wheel.forEach(([, g]) => g.dispose());
  const merged = merge(parts);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

