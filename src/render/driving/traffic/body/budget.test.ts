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
 * thousand triangles on High and twelve hundred on Low (a little over for
 * the longest body and the cab's sign), and every tier is lighter than the
 * one above it.
 */
const BODY_BUDGET: Record<DetailName, number> = { high: 3150, medium: 2600, low: 1300 };
const WHEEL_BUDGET: Record<DetailName, number> = { high: 480, medium: 400, low: 300 };

describe('traffic triangle budgets', () => {
  for (let kind = 0; kind < CAR_KINDS; kind++) {
    it(`keeps body type ${kind} within budget on every tier`, () => {
      const counts = (['high', 'medium', 'low'] as const).map((tier) => {
        const { geometry } = buildTrafficBody(CAR_SHAPES[kind], TRAFFIC_DETAIL[tier]);
        const n = triangles(geometry);
        geometry.dispose();
        expect(n, tier).toBeLessThan(BODY_BUDGET[tier]);
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
