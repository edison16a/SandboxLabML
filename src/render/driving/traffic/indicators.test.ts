import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAR_KINDS, type WorldState } from '@/engine/driving/world/state';
import { TRAFFIC_DETAIL } from './body/detail';
import { buildTrafficBody } from './carGeometry';
import { LAMP } from './looks';
import { CAR_SHAPES } from './shapes';
import { TrafficMotion } from './trafficMotion';

/**
 * The world sets FLAG_LEFT for a counterclockwise turn, so the lamps coded
 * left must sit on the car's left once placed: north of an east facing
 * car (world y above it) and west of a north facing one.
 */
describe('traffic indicators', () => {
  for (let kind = 0; kind < CAR_KINDS; kind++) {
    it(`puts body type ${kind}'s left indicators on the car's left`, () => {
      const { geometry } = buildTrafficBody(CAR_SHAPES[kind], TRAFFIC_DETAIL.low);
      const pos = geometry.attributes.position;
      const lamp = geometry.attributes.lamp;
      const motion = new TrafficMotion();
      const m = new THREE.Matrix4();
      const p = new THREE.Vector3();
      for (const [heading, side] of [[0, (q: THREE.Vector3) => -q.z - 3], [Math.PI / 2, (q: THREE.Vector3) => 2 - q.x]] as const) {
        const world = { carX: Float32Array.of(2), carY: Float32Array.of(3), carHeading: Float32Array.of(heading) } as unknown as WorldState;
        motion.compose(0, world, m);
        let left = 0;
        let right = 0;
        for (let i = 0; i < pos.count; i++) {
          const code = lamp.getX(i);
          if (code !== LAMP.left && code !== LAMP.right) continue;
          // How far the vertex lies toward the car's left, in world meters.
          const toLeft = side(p.fromBufferAttribute(pos, i).applyMatrix4(m));
          if (code === LAMP.left) {
            expect(toLeft).toBeGreaterThan(0.1);
            left++;
          } else {
            expect(toLeft).toBeLessThan(-0.1);
            right++;
          }
        }
        expect(left).toBeGreaterThan(0);
        expect(right).toBe(left);
      }
      geometry.dispose();
    });
  }
});
