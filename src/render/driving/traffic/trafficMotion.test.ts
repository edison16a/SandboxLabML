import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAR_KINDS, type WorldState } from '@/engine/driving/world/state';
import { axles } from './body/frame';
import { contactShadowMatrix } from './contactShadow';
import { CAR_SHAPES } from './shapes';
import { TrafficMotion } from './trafficMotion';

describe('traffic wheel placement', () => {
  it('puts every wheel on its body type axle, track and radius', () => {
    const motion = new TrafficMotion();
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    for (let kind = 0; kind < CAR_KINDS; kind++) {
      // wheel() reads only the car's kind from the snapshot.
      const world = { carKind: Uint8Array.of(kind) } as unknown as WorldState;
      const shape = CAR_SHAPES[kind];
      const [front, rear] = axles(shape);
      motion.body.identity();
      for (let w = 0; w < 4; w++) {
        p.setFromMatrixPosition(motion.wheel(0, w, world, m));
        expect(p.x).toBeCloseTo(w < 2 ? front : rear, 6);
        expect(p.y).toBeCloseTo(shape.wheelRadius, 6);
        // Left wheels (even w) sit on the car's left, local -z.
        expect(p.z).toBeCloseTo((w % 2 === 0 ? -1 : 1) * shape.track, 6);
      }
    }
  });
});

describe('traffic contact patches', () => {
  it('lie flat under each car, a little larger than its footprint', () => {
    const motion = new TrafficMotion();
    const body = new THREE.Matrix4();
    const out = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const world = { carX: Float32Array.of(10), carY: Float32Array.of(-4), carHeading: Float32Array.of(0.7) } as unknown as WorldState;
    for (let kind = 0; kind < CAR_KINDS; kind++) {
      motion.compose(0, world, body);
      contactShadowMatrix(body, CAR_SHAPES[kind], out).decompose(p, q, s);
      // World y maps to -z, so a car at y = -4 sits at z = 4.
      expect(p.x).toBeCloseTo(10, 5);
      expect(p.z).toBeCloseTo(4, 5);
      expect(p.y).toBeGreaterThan(0.005);
      expect(p.y).toBeLessThan(0.03);
      expect(s.x).toBeGreaterThan(CAR_SHAPES[kind].length);
      expect(s.z).toBeGreaterThan(CAR_SHAPES[kind].width);
    }
  });
});
