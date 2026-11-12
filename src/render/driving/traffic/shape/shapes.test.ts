import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAR_DIMENSIONS, CAR_KINDS, CAR_SEDAN } from '@/engine/driving/world/state';
import { TRAFFIC_DETAIL } from '../body/detail';
import { axles } from '../body/frame';
import { buildShell } from '../body/shell';
import { buildTrafficBody } from '../carGeometry';
import { CAR_SHAPES } from '../shapes';
import { faces, seenFromInside, wheelFaces, type Face } from '../testing/closure';

/** The five directions the closure check looks from: both sides, above, and both ends. */
const DIRS = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)];

/** Rays from each direction that meet the inside of a surface, liners forgiven except from above. */
function holes(street: Face[], box: THREE.Box3): Record<string, number> {
  return Object.fromEntries(DIRS.map((dir) => [dir.toArray().join(','), seenFromInside(street, dir, box, dir.y === 0)]));
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
        // The drawn half's widest point is the body's half width; mirrors stand a little proud of it.
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
        const d = TRAFFIC_DETAIL[tier];
        const { geometry } = buildTrafficBody(shape, d);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox as THREE.Box3;
        const tris = faces(geometry, shape, d);
        for (const [dir, bad] of Object.entries(holes([...tris, ...wheelFaces(shape)], box))) expect(bad, `${tier} ${dir}`).toBe(0);
        // Smooth normals always lean the same way as their face, and the skin faces away from the
        // car's middle. Liners face their wheel and mirrors stand out from the door, so only those
        // two are left out of the second check, and the underbody just has to face down. A few
        // slivers at the wheel openings' straight sides face their wheel. The core runs along the
        // car just above the sill, so the hood and deck, which sit below the roof's middle height,
        // still have to face up and away from it.
        const core = box.min.y + 0.12;
        const roof = Math.max(...buildShell(shape, d).panels.map((g) => (g.computeBoundingBox(), (g.boundingBox as THREE.Box3).max.y)));
        let flipped = 0;
        let inward = 0;
        for (const t of tris) {
          if (t.vn.some((v) => v.dot(t.n) < 0)) flipped++;
          const c = t.p[0].clone().add(t.p[1]).add(t.p[2]).divideScalar(3);
          // The cab's sign stands above the roof, its underside facing down at it.
          if (t.part === 'underbody' && t.n.y > -0.5) inward++;
          if (t.part !== 'body' || c.y > roof + 0.005) continue;
          const axis = new THREE.Vector3(THREE.MathUtils.clamp(c.x, -length / 2 + 0.7, length / 2 - 0.7), core, 0);
          if (t.n.dot(c.sub(axis)) < 0) inward++;
        }
        expect(flipped / tris.length, tier).toBeLessThan(0.005);
        expect(inward / tris.length, tier).toBeLessThan(0.005);
        geometry.dispose();
      }
    });
  }

  it('sees a hole cut in the roof', () => {
    // The check must not be blind from above: a 60 by 40 cm hole over the cabin has to show.
    const shape = CAR_SHAPES[CAR_SEDAN];
    const d = TRAFFIC_DETAIL.high;
    const { geometry } = buildTrafficBody(shape, d);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox as THREE.Box3;
    const roof = box.max.y;
    const all = faces(geometry, shape, d);
    const tris = all.filter((t) => {
      const c = t.p[0].clone().add(t.p[1]).add(t.p[2]).divideScalar(3);
      return !(Math.abs(c.x + 0.1) < 0.3 && Math.abs(c.z) < 0.2 && c.y > roof - 0.1);
    });
    expect(all.length - tris.length).toBeGreaterThan(2);
    expect(seenFromInside([...tris, ...wheelFaces(shape)], DIRS[2], box, false)).toBeGreaterThan(0);
    geometry.dispose();
  });
});
