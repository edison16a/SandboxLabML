import type * as THREE from 'three';
import type { Flight, Orbit } from '@/render/hideseek/camera/flight';
import { orbitShot } from '@/render/hideseek/camera/framing';
import { stepSpring } from '@/render/shared/interpolate';
import { FOLLOW, followShot } from './shots';

/** The runner the camera follows this frame, and what can make it jump. */
export interface FollowTarget {
  /** A new key (a new view or a new course) flies to a fresh follow shot. */
  key: number;
  x: number;
  z: number;
  /** A new episode puts everyone back on the start pad: the camera flies there, keeping your angle. */
  epoch: number;
  /** Half the course's size, m, to keep the aim inside it. */
  hx: number;
  hz: number;
}

/**
 * The follow view. The aim trails the runner on critically damped springs
 * stepped in simulation time, so the camera has its own smooth motion that
 * no single frame of the runner can jolt: a stumble, a push or the view
 * moving to a new leader all become one soft glide. Camera and aim move
 * together, so the angle and distance you orbit to are kept. Allocates
 * nothing per frame.
 */
export class FollowBest {
  private readonly aim = { x: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 } };
  private readonly offset = { x: 0, y: 0, z: 0 };
  private epoch = Number.NaN;

  update(camera: THREE.Camera, c: Orbit, f: Flight, t: FollowTarget, dt: number, timeScale: number): void {
    const ax = Math.max(-t.hx, Math.min(t.hx, t.x + FOLLOW.lead));
    const az = Math.max(-t.hz, Math.min(t.hz, t.z));
    if (t.key !== f.key) {
      f.key = t.key;
      this.epoch = t.epoch;
      this.fly(camera, c, f, followShot(t.x, t.z));
    } else if (f.t >= 1 && t.epoch !== this.epoch) {
      this.epoch = t.epoch;
      const dx = camera.position.x - c.target.x;
      const dy = camera.position.y - c.target.y;
      const dz = camera.position.z - c.target.z;
      const flat = Math.hypot(dx, dz);
      this.fly(camera, c, f, orbitShot(ax, az, Math.hypot(flat, dy), Math.atan2(dy, flat), Math.atan2(dx, dz), FOLLOW.height));
    }
    if (f.t < 1) {
      // Mid flight the destination moves with the runner, and the aim waits there for the flight to land.
      f.toTarget.set(ax, FOLLOW.height, az);
      f.toPos.set(ax + this.offset.x, FOLLOW.height + this.offset.y, az + this.offset.z);
      this.settle(ax, az);
      return;
    }
    const sim = Math.min(0.25, dt * timeScale);
    const nx = stepSpring(this.aim.x, ax, FOLLOW.stiffness, sim);
    const nz = stepSpring(this.aim.z, az, FOLLOW.stiffness, sim);
    f.carry(camera, c, nx - c.target.x, FOLLOW.height - c.target.y, nz - c.target.z);
  }

  private fly(camera: THREE.Camera, c: Orbit, f: Flight, shot: { px: number; py: number; pz: number; tx: number; ty: number; tz: number }): void {
    this.offset.x = shot.px - shot.tx;
    this.offset.y = shot.py - shot.ty;
    this.offset.z = shot.pz - shot.tz;
    // The aim starts where the shot looks, so the spring never pulls the view back from wherever it last rested.
    this.settle(shot.tx, shot.tz);
    f.start(camera, c, shot);
  }

  private settle(x: number, z: number): void {
    this.aim.x.value = x;
    this.aim.z.value = z;
    this.aim.x.velocity = this.aim.z.velocity = 0;
  }
}
