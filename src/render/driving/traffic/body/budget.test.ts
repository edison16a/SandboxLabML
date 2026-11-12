import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAR_KINDS } from '@/engine/driving/world/state';
import { buildTrafficBody } from '../carGeometry';
import { CAR_SHAPES } from '../shapes';
import { WHEEL_BUILT } from '../trafficMotion';
import { trafficWheelGeometry } from '../wheelGeometry';
import { TRAFFIC_DETAIL, type DetailName } from './detail';

const triangles = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/**
 * Traffic is drawn many times at once, so each body type stays near three
 * thousand triangles on High, and every tier is lighter than the one above
 * it. Each car also draws four wheels, so the whole car has a budget too:
 * on Low the light wheel (about 150) pays for a smoother roofline, and a
 * car costs about 2,000 there, down from 2,360 with the old 272 wheel.
 */
const BODY_BUDGET: Record<DetailName, number> = { high: 3150, medium: 2600, low: 1400 };
const WHEEL_BUDGET: Record<DetailName, number> = { high: 450, medium: 380, low: 170 };
const CAR_BUDGET: Record<DetailName, number> = { high: 4900, medium: 4050, low: 2050 };

describe('traffic triangle budgets', () => {
  for (let kind = 0; kind < CAR_KINDS; kind++) {
    it(`keeps body type ${kind} within budget on every tier`, () => {
      const counts = (['high', 'medium', 'low'] as const).map((tier) => {
        const { geometry } = buildTrafficBody(CAR_SHAPES[kind], TRAFFIC_DETAIL[tier]);
        const n = triangles(geometry);
        const wheel = trafficWheelGeometry(WHEEL_BUILT, TRAFFIC_DETAIL[tier].wheel);
        geometry.dispose();
        expect(n, tier).toBeLessThan(BODY_BUDGET[tier]);
        expect(n + 4 * triangles(wheel), tier).toBeLessThan(CAR_BUDGET[tier]);
        wheel.dispose();
        return n;
      });
      expect(counts[1]).toBeLessThan(counts[0]);
      expect(counts[2]).toBeLessThan(counts[1]);
    });
  }

  it('keeps the shared wheel light on every tier', () => {
    for (const tier of ['high', 'medium', 'low'] as const) {
      const g = trafficWheelGeometry(WHEEL_BUILT, TRAFFIC_DETAIL[tier].wheel);
      expect(triangles(g), tier).toBeLessThan(WHEEL_BUDGET[tier]);
      g.dispose();
    }
  });
});
