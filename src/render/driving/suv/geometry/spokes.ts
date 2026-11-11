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

/**
 * The five double spokes of the SUV's 22 inch wheel, faces chamfered so
 * their edges catch the light. The faces come back apart from the rest:
 * they are machined bright while the sides and pockets stay dark.
 */
export function spokes(detail: Detail): { faces: THREE.BufferGeometry; sides: THREE.BufferGeometry } {
  const depth = detail.brakes ? 0.026 : 0.02;
  const bevel = detail.brakes ? 0.005 : 0;
  const one = new THREE.ExtrudeGeometry(yOutline(), { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 });
  one.translate(0, 0, -depth + bevel);
  const flat = one.index ? one.toNonIndexed() : one;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < COUNT; i++) parts.push(flat.clone().rotateZ((i / COUNT) * Math.PI * 2));
  return splitFaces(dish(merge(parts)));
}

/** Splits flat shaded triangles into those facing out along +Z (the machined faces) and the rest. */
function splitFaces(g: THREE.BufferGeometry): { faces: THREE.BufferGeometry; sides: THREE.BufferGeometry } {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const out = { faces: [] as number[], sides: [] as number[] };
  for (let t = 0; t < pos.count; t += 3) {
    const nz = (nor.getZ(t) + nor.getZ(t + 1) + nor.getZ(t + 2)) / 3;
    out[nz > 0.82 ? 'faces' : 'sides'].push(t, t + 1, t + 2);
  }
  const pick = (list: number[]) => {
    const p = new Float32Array(list.length * 3);
    const n = new Float32Array(list.length * 3);
    list.forEach((v, i) => {
      p.set([pos.getX(v), pos.getY(v), pos.getZ(v)], i * 3);
      n.set([nor.getX(v), nor.getY(v), nor.getZ(v)], i * 3);
    });
    const part = new THREE.BufferGeometry();
    part.setAttribute('position', new THREE.BufferAttribute(p, 3));
    part.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    // Plain UVs, so the parts merge with the lathed rim pieces that carry them.
    part.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(list.length * 2), 2));
    return part;
  };
  const faces = pick(out.faces);
  const sides = pick(out.sides);
  g.dispose();
  return { faces, sides };
}
