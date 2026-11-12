import * as THREE from 'three';
import { MAX_TRAFFIC, type WorldState } from '@/engine/driving/world/state';
import { axles } from './body/frame';
import { CAR_SHAPES } from './shapes';

/** Radius the shared wheel mesh is built at, m. */
export const WHEEL_BUILT = 0.34;
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/**
 * Per car motion the snapshot does not carry: how far each car's wheels
 * have rolled and how far its front wheels are turned, worked out from
 * its speed and how fast its heading changes. Typed arrays and scratch
 * objects only, so a frame allocates nothing.
 */
export class TrafficMotion {
  readonly spin = new Float32Array(MAX_TRAFFIC);
  readonly steer = new Float32Array(MAX_TRAFFIC);
  readonly heading = new Float32Array(MAX_TRAFFIC);
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly ws = new THREE.Vector3(1, 1, 1);
  readonly body = new THREE.Matrix4();
  private readonly local = new THREE.Matrix4();

  update(world: WorldState, dt: number): void {
    for (let i = 0; i < world.carCount; i++) {
      const shape = CAR_SHAPES[world.carKind[i]];
      const v = world.carSpeed[i];
      this.spin[i] = (this.spin[i] + (v * dt) / shape.wheelRadius) % (Math.PI * 2);
      let dh = world.carHeading[i] - this.heading[i];
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.heading[i] = world.carHeading[i];
      // Bicycle model backwards: the wheel angle that turns this fast at this speed, eased so it never twitches.
      const target = v > 0.5 && dt > 0 && Math.abs(dh) < 0.5 ? Math.atan(((dh / dt) * shape.wheelbase) / v) : 0;
      this.steer[i] += (Math.max(-0.6, Math.min(0.6, target)) - this.steer[i]) * Math.min(1, dt * 8);
    }
  }

  /** Car i's body matrix from its world pose. */
  compose(i: number, world: WorldState, out: THREE.Matrix4): THREE.Matrix4 {
    this.q.setFromAxisAngle(Y, world.carHeading[i]);
    this.p.set(world.carX[i], 0, -world.carY[i]);
    return out.compose(this.p, this.q, this.s);
  }

  /** Wheel w of car i (front pair first, left then right) relative to the body. */
  wheel(i: number, w: number, world: WorldState, out: THREE.Matrix4): THREE.Matrix4 {
    const shape = CAR_SHAPES[world.carKind[i]];
    const front = w < 2;
    const left = w % 2 === 0;
    const [ahead, behind] = axles(shape);
    this.p.set(front ? ahead : behind, shape.wheelRadius, (left ? 1 : -1) * shape.track);
    // Right wheels turn round to face out; then the front pair steers and every wheel rolls.
    this.q.setFromAxisAngle(Y, (front ? this.steer[i] : 0) + (left ? 0 : Math.PI));
    this.q2.setFromAxisAngle(Z, left ? -this.spin[i] : this.spin[i]);
    this.q.multiply(this.q2);
    // The wheel mesh is built at WHEEL_BUILT; each body type scales it to its own wheels.
    const k = shape.wheelRadius / WHEEL_BUILT;
    this.local.compose(this.p, this.q, this.ws.set(k, k, 1));
    return out.multiplyMatrices(this.body, this.local);
  }
}

/** Writes car i's four wheels into the wheel mesh from slot `n`, returning the next free slot. */
export function placeWheels(motion: TrafficMotion, i: number, world: WorldState, body: THREE.Matrix4, mesh: THREE.InstancedMesh, n: number): number {
  motion.body.copy(body);
  for (let w = 0; w < 4; w++) mesh.setMatrixAt(n + w, motion.wheel(i, w, world, scratch));
  return n + 4;
}

const scratch = new THREE.Matrix4();
