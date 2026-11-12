import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SUV, SUV_SIZE } from '@/engine/driving/car/params';
import { BODY, WHEEL } from '../dimensions';
import { WELL_Z } from './arches';
import { buildBody, crowdSuvGeometry } from './assemble';
import { CABIN } from './cabin';
import { DETAIL } from './parts';
import { archFloor, AXLES } from './profile';
import { buildWheel, caliper } from './wheels';

const triangles = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/** Triangles in a whole hero SUV at a tier: the body once, the wheel four times. */
function heroTriangles(tier: 'high' | 'medium' | 'low'): number {
  const body = [...buildBody(DETAIL[tier]).values()].reduce((n, g) => n + triangles(g), 0);
  const wheel = [...buildWheel(DETAIL[tier]).values()].reduce((n, g) => n + triangles(g), 0) + triangles(caliper(DETAIL[tier]));
  return body + 4 * wheel;
}

function bounds(tier: keyof typeof DETAIL): THREE.Box3 {
  const box = new THREE.Box3();
  for (const g of buildBody(DETAIL[tier]).values()) {
    g.computeBoundingBox();
    box.union(g.boundingBox as THREE.Box3);
  }
  return box;
}

describe('procedural SUV', () => {
  it('keeps the hero SUV within its triangle budget, lighter on lower tiers', () => {
    const high = heroTriangles('high');
    expect(high).toBeLessThan(60_000);
    expect(heroTriangles('medium')).toBeLessThan(high);
    expect(heroTriangles('low')).toBeLessThan(heroTriangles('medium'));
  });

  it('keeps the population SUV light enough for a 256 car field, and lighter still on Low', () => {
    const crowd = triangles(crowdSuvGeometry());
    expect(crowd).toBeLessThan(7_000);
    const low = triangles(crowdSuvGeometry(DETAIL.crowdLow));
    expect(low).toBeLessThan(crowd * 0.75);
    // Low's budget: a 100 car field plus 32 ghosts, each ghost drawn twice (depth, then color), under 550k triangles.
    expect(low * (100 + 2 * 32)).toBeLessThan(550_000);
  });

  it('fits the footprint the simulation, detections and overlays assume', () => {
    for (const tier of ['high', 'crowd'] as const) {
      const box = bounds(tier);
      expect(box.max.x - box.min.x).toBeGreaterThan(SUV_SIZE.length - 0.1);
      expect(box.max.x - box.min.x).toBeLessThan(SUV_SIZE.length + 0.08);
      // Mirrors stand a little proud of the 2 m box, as on any car.
      expect(box.max.z - box.min.z).toBeLessThan(SUV_SIZE.width + 0.3);
      expect(box.max.z + box.min.z).toBeCloseTo(0, 3);
      expect(box.max.y).toBeGreaterThan(1.64);
      expect(box.max.y).toBeLessThan(1.7);
    }
  });

  it('puts the wheels a wheelbase apart under the cabin', () => {
    expect(BODY.axleFront - BODY.axleRear).toBeCloseTo(SUV.wheelbase, 3);
    expect(CABIN.front).toBeLessThan(BODY.axleFront);
  });

  it('clears the tires under every wheel arch', () => {
    for (const axle of AXLES) {
      for (let dx = -WHEEL.radius; dx <= WHEEL.radius; dx += 0.02) {
        const tireTop = WHEEL.radius + Math.sqrt(WHEEL.radius ** 2 - dx * dx);
        expect(archFloor(axle + dx)).toBeGreaterThan(tireTop + 0.03);
      }
    }
  });

  it('keeps the front wheel off the inner well wall at full lock', () => {
    // Front wheels steer about their center, so turn every vertex both ways and find the furthest inboard.
    const parts = [...buildWheel(DETAIL.high).values(), caliper(DETAIL.high)];
    let inner = Infinity;
    for (const g of parts) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        for (const a of [SUV.steerMax, -SUV.steerMax]) inner = Math.min(inner, BODY.track - p.getX(i) * Math.sin(a) + p.getZ(i) * Math.cos(a));
      }
    }
    expect(inner).toBeGreaterThan(WELL_Z + 0.01);
  });
});
