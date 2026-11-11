import * as THREE from 'three';
import { WHEEL } from '../dimensions';
import { merge } from './grid';
import type { Detail } from './parts';

const COUNT = 5;
const HUB = 0.07;
const SPLIT = 0.15;
const END = WHEEL.rim - 0.012;
/** How far the hub sits behind the rim lip: a shallow dish, as on a road car's forged wheel. */
const DISH = 0.032;
const FACE = WHEEL.width / 2 - 0.012;

/**
 * Outline of one Y spoke, pointing up the +Y axis: a stem from the hub that
 * forks into two arms meeting the rim. Five of them make ten arms at the
 * rim, a classic five double spoke design, open enough to show the brakes.
 */
function yOutline(): THREE.Shape {
  const spread = 0.22;
  const arm = 0.0125;
  const stem = [0.021, 0.017];
  const fork = new THREE.Vector2(0, SPLIT);
  const edges = [-1, 1].map((s) => {
    const end = new THREE.Vector2(Math.sin(s * spread) * END, Math.cos(s * spread) * END);
    const d = end.clone().sub(fork).normalize();
    // Perpendicular to the arm, pointing away from the stem's centerline.
    const away = new THREE.Vector2(-d.y, d.x).multiplyScalar(-s * arm);
    return { outer: end.clone().add(away), inner: end.clone().sub(away) };
  });
  const pts = [
    new THREE.Vector2(-stem[0], HUB - 0.004),
    new THREE.Vector2(-stem[1], SPLIT - 0.01),
    edges[0].outer,
    edges[0].inner,
    new THREE.Vector2(0, SPLIT + 0.05),
    edges[1].inner,
    edges[1].outer,
    new THREE.Vector2(stem[1], SPLIT - 0.01),
    new THREE.Vector2(stem[0], HUB - 0.004),
  ];
  return new THREE.Shape(pts);
}

/**
 * Bends flat spokes into the wheel's dish: the further from the rim, the
 * deeper they sit. Normals come out flat per face, which suits machined
 * metal.
 */
function dish(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    const t = Math.min(1, Math.max(0, (r - HUB) / (END - HUB)));
    p.setZ(i, p.getZ(i) + FACE - DISH * (1 - t) * (1 - t * 0.35));
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** The five double spokes of the SUV's 22 inch wheel, faces chamfered so their edges catch the light. */
export function spokes(detail: Detail): THREE.BufferGeometry {
  const depth = detail.brakes ? 0.026 : 0.02;
  const bevel = detail.brakes ? 0.005 : 0;
  const one = new THREE.ExtrudeGeometry(yOutline(), { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 });
  one.translate(0, 0, -depth + bevel);
  const flat = one.index ? one.toNonIndexed() : one;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < COUNT; i++) parts.push(flat.clone().rotateZ((i / COUNT) * Math.PI * 2));
  return dish(merge(parts));
}
