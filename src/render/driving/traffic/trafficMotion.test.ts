import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAR_KINDS, type WorldState } from '@/engine/driving/world/state';
import { axles } from './body/frame';
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
        expect(p.z).toBeCloseTo((w % 2 === 0 ? 1 : -1) * shape.track, 6);
      }
    }
  });
});
