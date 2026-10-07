import * as THREE from 'three';
import { easeInOutCubic, type Shot } from './framing';

/** How long a change of view or focus takes to fly, s. */
const FLY_SECONDS = 0.6;

/** The part of the orbit controls a flight moves: the point it orbits, and a way to apply a change. */
export interface Orbit {
  target: THREE.Vector3;
  update(): void;
}

/**
 * The camera's moves between views: a flight to a new shot with an ease
 * in and out, and carrying camera and orbit point together (to follow an
 * agent or stay inside the bounds) so the angle and distance you chose by
 * hand are kept. Every vector is allocated once.
 */
export class Flight {
  /** Key of the shot last framed; a different one starts a new flight. */
  key = Number.NaN;
  /** Progress of the current flight, 1 when there is none. */
  t = 1;
  private started = false;
  readonly fromPos = new THREE.Vector3();
  readonly fromTarget = new THREE.Vector3();
  readonly toPos = new THREE.Vector3();
  readonly toTarget = new THREE.Vector3();
  readonly look = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();

  /** Flies from where the camera is to `shot`. The very first framing jumps straight there. */
  start(camera: THREE.Camera, c: Orbit, shot: Shot): void {
    this.fromPos.copy(camera.position);
    this.fromTarget.copy(c.target);
    this.toPos.set(shot.px, shot.py, shot.pz);
    this.toTarget.set(shot.tx, shot.ty, shot.tz);
    this.t = this.started ? 0 : 1;
    this.started = true;
    if (this.t >= 1) {
      camera.position.copy(this.toPos);
      c.target.copy(this.toTarget);
      camera.lookAt(this.toTarget);
      c.update();
    }
  }

  /** Advances the flight by `dt` seconds. */
  step(camera: THREE.Camera, c: Orbit, dt: number): void {
    this.t = Math.min(1, this.t + dt / FLY_SECONDS);
    const e = easeInOutCubic(this.t);
    camera.position.lerpVectors(this.fromPos, this.toPos, e);
    this.look.lerpVectors(this.fromTarget, this.toTarget, e);
    c.target.copy(this.look);
    camera.lookAt(this.look);
    c.update();
  }

  /** Moves the camera and its orbit point together by (dx, dy, dz). */
  carry(camera: THREE.Camera, c: Orbit, dx: number, dy: number, dz: number): void {
    this.delta.set(dx, dy, dz);
    c.target.add(this.delta);
    camera.position.add(this.delta);
  }

  /** Keeps the orbit point inside |x| <= hx, |z| <= hz and on or above the floor, carrying the camera with it. */
  keepInBounds(camera: THREE.Camera, c: Orbit, hx: number, hz: number): void {
    const t = c.target;
    const dx = THREE.MathUtils.clamp(t.x, -hx, hx) - t.x;
    const dy = Math.max(0, t.y) - t.y;
    const dz = THREE.MathUtils.clamp(t.z, -hz, hz) - t.z;
    if (dx !== 0 || dy !== 0 || dz !== 0) this.carry(camera, c, dx, dy, dz);
  }
}
