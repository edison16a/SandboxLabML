import * as THREE from 'three';
import { GRAVITY, type CarParams } from '@/engine/racing/car/params';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { readTickMotion, tickMotion } from './tickMotion';

const STRIDE = RACING_SNAPSHOT.stride;
/** Fewer sub-steps than the followed car: these springs are soft, and a hundred of them run every frame. */
const MAX_STEP = 1 / 120;

/** Springs stored as (position, velocity) pairs in one typed array, one pair per car. */
function step(a: Float32Array, i: number, target: number, freq: number, zeta: number, dt: number): number {
  const w = Math.PI * 2 * freq;
  const k = w * w;
  const c = 2 * zeta * w;
  let x = a[i * 2];
  let v = a[i * 2 + 1];
  for (let left = Math.min(dt, 0.25); left > 1e-6; left -= MAX_STEP) {
    const h = Math.min(MAX_STEP, left);
    v += (k * (target - x) - c * v) * h;
    x += v * h;
  }
  a[i * 2] = x;
  a[i * 2 + 1] = v;
  return x;
}

/**
 * The lighter body motion for a whole field of instanced cars: pitch, roll
 * and a slip angle at the limit, from each car's real accelerations, on
 * the same springs as the followed car with no wheel contact. A hundred
 * cars cost a short loop and allocate nothing.
 */
export class FleetMotion {
  private readonly pitch: Float32Array;
  private readonly roll: Float32Array;
  private readonly slip: Float32Array;
  private readonly accLong: Float32Array;
  private readonly accLat: Float32Array;
  private readonly usage: Float32Array;
  private readonly tmp = tickMotion();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private tick = -1;
  private epoch = -1;

  constructor(readonly capacity: number) {
    this.pitch = new Float32Array(capacity * 2);
    this.roll = new Float32Array(capacity * 2);
    this.slip = new Float32Array(capacity * 2);
    this.accLong = new Float32Array(capacity);
    this.accLat = new Float32Array(capacity);
    this.usage = new Float32Array(capacity);
  }

  /** Reads new accelerations when a snapshot arrives, then steps every car's springs by `dt`. */
  update(stream: SnapshotStream, count: number, car: CarParams, dt: number): void {
    const curr = stream.curr;
    const prev = stream.prev;
    if (stream.epoch !== this.epoch) {
      this.epoch = stream.epoch;
      [this.pitch, this.roll, this.slip, this.accLong, this.accLat, this.usage].forEach((a) => a.fill(0));
    }
    if (curr && prev && curr.tick !== this.tick) {
      this.tick = curr.tick;
      const ticks = curr.tick - prev.tick;
      for (let i = 0; i < count; i++) {
        if (ticks <= 0 || ticks > 20) {
          this.accLong[i] = this.accLat[i] = this.usage[i] = 0;
          continue;
        }
        readTickMotion(prev.buffer, curr.buffer, i * STRIDE, ticks, car, this.tmp);
        this.accLong[i] = this.tmp.accelLong;
        this.accLat[i] = this.tmp.accelLat;
        this.usage[i] = this.tmp.usage;
      }
    }
    for (let i = 0; i < count; i++) {
      step(this.pitch, i, (this.accLong[i] / GRAVITY) * 0.023, 1.6, 0.42, dt);
      step(this.roll, i, (this.accLat[i] / GRAVITY) * 0.04, 1.4, 0.48, dt);
      const limit = Math.min(1, Math.max(0, (this.usage[i] - 0.55) / 0.4));
      step(this.slip, i, this.accLat[i] * 0.0032 * limit * limit, 1.1, 0.7, dt);
    }
  }

  /** Writes car i's matrix: placed at (x, y, z) facing `heading`, with its body motion and a uniform `scale`. */
  compose(i: number, x: number, y: number, z: number, heading: number, scale: number, out: THREE.Matrix4): THREE.Matrix4 {
    this.euler.set(this.roll[i * 2], heading + this.slip[i * 2], this.pitch[i * 2]);
    this.q.setFromEuler(this.euler);
    return out.compose(this.p.set(x, y, z), this.q, this.s.setScalar(scale));
  }
}
