import type * as THREE from 'three';
import type { Flight, Orbit } from '@/render/hideseek/camera/flight';
import { orbitShot } from '@/render/hideseek/camera/framing';
import { stepSpring } from '@/render/shared/interpolate';
import { FOLLOW, followAim, followAzimuth, followShot, followSide } from './shots';

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
  private readonly at = { x: 0, z: 0 };
  private epoch = Number.NaN;
  /** The side of the runner the camera keeps to, and its azimuth gliding toward that side on a spring. */
  private side = 1;
  private readonly azimuth = { value: followAzimuth(1), velocity: 0 };

  update(camera: THREE.Camera, c: Orbit, f: Flight, t: FollowTarget, dt: number, timeScale: number): void {
    followAim(t.x, t.z, t.hx, t.hz, this.at);
    const ax = this.at.x;
    const az = this.at.z;
    if (t.key !== f.key) {
      f.key = t.key;
      this.epoch = t.epoch;
      this.side = followSide(t.z, this.side);
      this.azimuth.value = followAzimuth(this.side);
      this.azimuth.velocity = 0;
      this.fly(camera, c, f, followShot(t.x, t.z, t.hx, t.hz, this.side));
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
    this.swing(camera, c, t.z, sim);
  }

  /**
   * Swings the camera round the aim to the side of the wall the runner is
   * near (see followSide), on its own spring, by turning whatever offset it
   * has: an angle you orbited to is kept, only shifted.
   */
  private swing(camera: THREE.Camera, c: Orbit, z: number, dt: number): void {
    this.side = followSide(z, this.side);
    const before = this.azimuth.value;
    const turn = stepSpring(this.azimuth, followAzimuth(this.side), FOLLOW.swing, dt) - before;
    if (Math.abs(turn) < 1e-7) return;
    const dx = camera.position.x - c.target.x;
    const dz = camera.position.z - c.target.z;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    camera.position.x = c.target.x + dx * cos + dz * sin;
    camera.position.z = c.target.z + dz * cos - dx * sin;
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
