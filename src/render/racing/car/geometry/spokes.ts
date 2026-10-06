import * as THREE from 'three';
import { WHEEL } from '../dimensions';
import { merge } from './grid';
import type { Detail } from './parts';

const COUNT = 5;
const HUB = 0.062;
const SPLIT = 0.135;
const END = WHEEL.rim - 0.012;
/** How far the hub sits behind the rim lip. A deep dish reads as a forged race wheel. */
const DISH = 0.05;
const FACE = WHEEL.width / 2 - 0.012;

/**
 * Outline of one Y spoke, pointing up the +Y axis: a stem from the hub that
 * forks into two arms meeting the rim. Five of them make ten arms at the
 * rim, open enough to show the disc and caliper behind.
 */
function yOutline(): THREE.Shape {
  const spread = 0.24;
  const arm = 0.0115;
  const stem = [0.019, 0.015];
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

/** The five Y spokes of a forged wheel, faces chamfered so their edges catch the light. */
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
