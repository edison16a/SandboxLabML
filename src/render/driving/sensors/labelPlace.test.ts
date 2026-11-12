import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAR_KINDS } from '@/engine/driving/world/state';
import { TRAFFIC_DETAIL } from '../traffic/body/detail';
import { buildTrafficBody } from '../traffic/carGeometry';
import { CAR_SHAPES } from '../traffic/shapes';
import { carBoxTop, carPillY } from './labelPlace';

describe('detection label placement', () => {
  for (let kind = 0; kind < CAR_KINDS; kind++) {
    it(`keeps the pill and the box top above body type ${kind}`, () => {
      const { geometry } = buildTrafficBody(CAR_SHAPES[kind], TRAFFIC_DETAIL.high);
      geometry.computeBoundingBox();
      const top = (geometry.boundingBox as THREE.Box3).max.y;
      geometry.dispose();
      // The pill is a flat quad at its center's depth, about 0.18 m tall up close: its lower edge must clear the roof.
      expect(carPillY(kind) - 0.2).toBeGreaterThan(top);
      expect(carBoxTop(kind)).toBeGreaterThan(top);
      expect(carBoxTop(kind)).toBeLessThan(top + 0.2);
    });
  }
});
