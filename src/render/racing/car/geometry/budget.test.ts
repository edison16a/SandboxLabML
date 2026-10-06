import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR } from '@/engine/racing/car/params';
import { CAR, WHEEL } from '../dimensions';
import { WELL_Z } from './arches';
import { buildBody } from './assemble';
import { archFloor, AXLES } from './bodyProfile';
import { crowdGeometry } from './crowd';
import { DETAIL } from './parts';
import { buildWheel, caliper } from './wheels';

const triangles = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/** Triangles in a whole hero car at a tier: the body once, the wheel four times. */
function heroTriangles(tier: 'high' | 'medium' | 'low'): number {
  const body = [...buildBody(DETAIL[tier]).values()].reduce((n, g) => n + triangles(g), 0);
  const wheel = [...buildWheel(DETAIL[tier]).values()].reduce((n, g) => n + triangles(g), 0) + triangles(caliper(DETAIL[tier]));
  return body + 4 * wheel;
}

describe('procedural car', () => {
  it('keeps the hero car within its triangle budget, lighter on lower tiers', () => {
    const high = heroTriangles('high');
    expect(high).toBeLessThan(60_000);
    expect(heroTriangles('medium')).toBeLessThan(high);
    expect(heroTriangles('low')).toBeLessThan(heroTriangles('medium'));
  });

  it('keeps the crowd car light enough for 256 instances', () => {
    expect(triangles(crowdGeometry())).toBeLessThan(8_000);
  });

  it('fits the footprint the simulation and tire marks assume', () => {
    const box = new THREE.Box3();
    for (const g of buildBody(DETAIL.crowd).values()) {
      g.computeBoundingBox();
      box.union(g.boundingBox as THREE.Box3);
    }
    expect(box.max.x - box.min.x).toBeGreaterThan(CAR.length - 0.1);
    expect(box.max.x - box.min.x).toBeLessThan(CAR.length + 0.15);
    expect(box.max.z - box.min.z).toBeLessThan(CAR.width + 0.12);
    expect(box.max.z + box.min.z).toBeCloseTo(0, 3);
    expect(box.max.y).toBeLessThan(1.25);
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
        for (const a of [DEFAULT_CAR.steerMax, -DEFAULT_CAR.steerMax]) inner = Math.min(inner, CAR.track - p.getX(i) * Math.sin(a) + p.getZ(i) * Math.cos(a));
      }
    }
    expect(inner).toBeGreaterThan(WELL_Z + 0.01);
  });
});
