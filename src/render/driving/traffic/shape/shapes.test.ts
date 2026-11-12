import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { CAR_DIMENSIONS, CAR_KINDS } from '@/engine/driving/world/state';
import { TRAFFIC_DETAIL } from '../body/detail';
import { axles } from '../body/frame';
import { buildShell } from '../body/shell';
import { buildTrafficBody } from '../carGeometry';
import { CAR_SHAPES } from '../shapes';
import { WHEEL_BUILT } from '../trafficMotion';
import { trafficWheelGeometry } from '../wheelGeometry';

/** The body with its four wheels in place, as the street sees it: tires fill the openings. */
function onWheels(shape: (typeof CAR_SHAPES)[number], body: THREE.BufferGeometry): THREE.BufferGeometry {
  const parts = [body];
  const k = shape.wheelRadius / WHEEL_BUILT;
  for (const x of axles(shape)) {
    for (const side of [1, -1]) {
      const w = trafficWheelGeometry(WHEEL_BUILT, 12).scale(k, k, 1);
      if (side < 0) w.rotateY(Math.PI);
      parts.push(w.translate(x, shape.wheelRadius, side * shape.track));
    }
  }
  return mergeGeometries(parts) as THREE.BufferGeometry;
}

/** Every triangle of a geometry as three points and its face normal, skipping slivers with no area. */
function faces(g: THREE.BufferGeometry): Array<{ p: THREE.Vector3[]; n: THREE.Vector3; vn: THREE.Vector3[]; color: number }> {
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const col = g.attributes.color;
  const out = [];
  for (let i = 0; i < pos.count; i += 3) {
    const p = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, i + k));
    const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    if (n.length() < 1e-9) continue;
    out.push({ p, n: n.normalize(), vn: [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(nrm, i + k)), color: col.getX(i) });
  }
  return out;
}

const ray = new THREE.Ray();
const hit = new THREE.Vector3();

/**
 * Looks at the body from one side along a grid of straight rays and
 * counts rays whose first hit is the inside of a surface: wherever the
 * body has a hole, a ray slips through and meets a face from behind.
 */
function seenFromInside(tris: ReturnType<typeof faces>, dir: THREE.Vector3, box: THREE.Box3): number {
  // Liners face their wheel by design; a ray that slips under a bumper into a wheel opening meets
  // one from behind, where in the street the tire would stop it. Their look is the darkest.
  const liner = (t: (typeof tris)[number]) => t.color < 0.01;
  const axis = Math.abs(dir.x) > 0.5 ? 0 : Math.abs(dir.y) > 0.5 ? 1 : 2;
  const [a, b] = [0, 1, 2].filter((k) => k !== axis);
  const min = box.min.toArray();
  const max = box.max.toArray();
  let bad = 0;
  for (let i = 1; i < 40; i++) {
    for (let j = 1; j < 24; j++) {
      const o = [0, 0, 0];
      o[a] = min[a] + ((max[a] - min[a]) * i) / 40;
      o[b] = min[b] + ((max[b] - min[b]) * j) / 24;
      o[axis] = dir.getComponent(axis) > 0 ? min[axis] - 1 : max[axis] + 1;
      ray.set(new THREE.Vector3(...o), dir);
      let best = Infinity;
      let facing = 1;
      for (const t of tris) {
        if (!ray.intersectTriangle(t.p[0], t.p[1], t.p[2], false, hit)) continue;
        const d = hit.distanceTo(ray.origin);
        if (d < best) {
          best = d;
          // A ray that skims a thin piece lying along it (a pillar on the glass, seen from behind)
          // meets its edge, not a hole: within a few degrees of grazing it counts as seen.
          facing = liner(t) || Math.abs(t.n.dot(dir)) < 0.05 ? 1 : -t.n.dot(dir);
        }
      }
      if (best < Infinity && facing < 0) bad++;
    }
  }
  return bad;
}

describe('traffic body types', () => {
  for (let kind = 0; kind < CAR_KINDS; kind++) {
    const shape = CAR_SHAPES[kind];
    const [length, width] = CAR_DIMENSIONS[kind];

    it(`matches the simulation's footprint for body type ${kind}`, () => {
      expect(shape.length).toBe(length);
      expect(shape.width).toBe(width);
      for (const tier of ['high', 'low'] as const) {
        const shell = buildShell(shape, TRAFFIC_DETAIL[tier]);
        const box = new THREE.Box3();
        for (const g of shell.panels) {
          g.computeBoundingBox();
          box.union(g.boundingBox as THREE.Box3);
        }
        expect(box.max.x - box.min.x, tier).toBeGreaterThan(length - 0.03);
        expect(box.max.x - box.min.x, tier).toBeLessThan(length + 0.01);
        expect(box.max.x + box.min.x, tier).toBeCloseTo(0, 1);
        // The left half's widest point is the body's half width; mirrors stand a little proud of it.
        expect(box.max.z, tier).toBeCloseTo(width / 2, 2);
      }
      // Every outline point of every piece lands on the body, on every tier.
      for (const tier of ['medium', 'low'] as const) {
        const built = buildTrafficBody(shape, TRAFFIC_DETAIL[tier]);
        expect(built.misses, tier).toBe(0);
        built.geometry.dispose();
      }
      const { geometry, misses } = buildTrafficBody(shape, TRAFFIC_DETAIL.high);
      expect(misses).toBe(0);
      geometry.computeBoundingBox();
      const all = geometry.boundingBox as THREE.Box3;
      expect(all.max.z).toBeLessThan(width / 2 + 0.2);
      expect(all.max.z + all.min.z).toBeCloseTo(0, 3);
      // Wheels sit inside the footprint, tires flush with the sides.
      const [front, rear] = axles(shape);
      expect(front + shape.wheelRadius).toBeLessThan(length / 2 - 0.3);
      expect(rear - shape.wheelRadius).toBeGreaterThan(-length / 2 + 0.3);
      expect(shape.track + 0.11).toBeLessThan(width / 2);
      expect(shape.track + 0.11).toBeGreaterThan(width / 2 - 0.06);
      geometry.dispose();
    });

    it(`is closed and faces out for body type ${kind}`, () => {
      for (const tier of ['high', 'low'] as const) {
        const { geometry } = buildTrafficBody(shape, TRAFFIC_DETAIL[tier]);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox as THREE.Box3;
        const tris = faces(geometry);
        const street = faces(onWheels(shape, geometry));
        for (const dir of [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)]) {
          expect(seenFromInside(street, dir, box), `${tier} ${dir.toArray()}`).toBe(0);
        }
        // Smooth normals always lean the same way as their face, and the skin faces away from the
        // car's middle. Liners face their wheel and mirrors stand out from the door, so both are
        // left out of the second check (their gloss black and dark looks are their own). A few
        // slivers at the wheel openings' straight sides lean against their neighbors' normals.
        // The core runs along the car just above the sill, so the hood and deck, which sit below
        // the roof's middle height, still have to face up and away from it.
        const core = box.min.y + 0.12;
        const roof = Math.max(...buildShell(shape, TRAFFIC_DETAIL[tier]).panels.map((g) => (g.computeBoundingBox(), (g.boundingBox as THREE.Box3).max.y)));
        let flipped = 0;
        let inward = 0;
        for (const t of tris) {
          if (t.vn.some((v) => v.dot(t.n) < 0)) flipped++;
          const c = t.p[0].clone().add(t.p[1]).add(t.p[2]).divideScalar(3);
          // The cab's sign stands above the roof, its underside facing down at it.
          if (t.color < 0.013 || c.y > roof + 0.005) continue;
          const axis = new THREE.Vector3(THREE.MathUtils.clamp(c.x, -length / 2 + 0.7, length / 2 - 0.7), core, 0);
          if (t.n.dot(c.sub(axis)) < 0) inward++;
        }
        expect(flipped / tris.length, tier).toBeLessThan(0.005);
        expect(inward / tris.length, tier).toBeLessThan(0.005);
        geometry.dispose();
      }
    });
  }
});
