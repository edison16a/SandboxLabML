import * as THREE from 'three';
import { stepSpring, type Spring } from '@/render/shared/interpolate';
import type { DrivingFrame } from '../frame/sceneContext';
import { chaseAnchor, stepAnchor, type ChaseAnchor } from './chaseAnchor';

/** Field of view at rest and the extra degrees it opens at town speed. */
export const FOV = 52;
const FOV_SPEED = 5;
const TOP_SPEED = 16;
/** Meters of road over which the camera turns most of the way to the car's heading. */
const TURN_DISTANCE = 7;
/** How fast the speed and acceleration the framing reads follow the car's, 1/s. */
const SMOOTH_RATE = 2.5;

/**
 * Chase camera state between frames. It follows its own anchor, never the
 * car directly; the x and z springs hold the camera's offset from it.
 */
export interface ChaseRig {
  anchor: ChaseAnchor;
  x: Spring;
  y: Spring;
  z: Spring;
  fov: Spring;
  yaw: number;
  look: THREE.Vector3;
  speed: number;
  accel: number;
  epoch: number;
}

export function chaseRig(): ChaseRig {
  const s = () => ({ value: 0, velocity: 0 });
  return { anchor: chaseAnchor(), x: s(), y: s(), z: s(), fov: { value: FOV, velocity: 0 }, yaw: 0, look: new THREE.Vector3(), speed: 0, accel: 0, epoch: -1 };
}

/**
 * A steady street level chase camera behind the followed SUV, high enough
 * to see over it to the junction ahead. It hangs off a gliding anchor, turns
 * with the car per meter of road (so a 90 degree turn swings it round
 * smoothly instead of whipping), backs off a little with speed and leans
 * in under braking. A new episode or a switch to a car across town starts
 * it right behind instead of flying over the rooftops.
 */
export function stepChase(rig: ChaseRig, frame: DrivingFrame, camera: THREE.PerspectiveCamera, dt: number): void {
  const anchor = rig.anchor;
  if (rig.epoch !== frame.epoch) {
    rig.epoch = frame.epoch;
    anchor.ready = false;
  }
  const px = anchor.x;
  const pz = anchor.z;
  const snapped = stepAnchor(anchor, frame.pos.x, frame.pos.z, frame.yaw, frame.focus, dt);
  const ease = 1 - Math.exp(-SMOOTH_RATE * dt);
  rig.speed = snapped ? frame.speed : rig.speed + (frame.speed - rig.speed) * ease;
  rig.accel = snapped ? 0 : rig.accel + (frame.motion.accelLong - rig.accel) * ease;
  const back = 8.6 + rig.speed * 0.12 + THREE.MathUtils.clamp(rig.accel * 0.12, -1.2, 0.8);
  const height = 3.0 + rig.speed * 0.03;
  const moved = snapped ? 0 : Math.hypot(anchor.x - px, anchor.z - pz);
  if (snapped) {
    rig.yaw = anchor.heading;
    rig.x.value = -Math.cos(rig.yaw) * back;
    rig.z.value = Math.sin(rig.yaw) * back;
    rig.y.value = height;
    rig.x.velocity = rig.y.velocity = rig.z.velocity = 0;
  } else {
    const delta = Math.atan2(Math.sin(anchor.heading - rig.yaw), Math.cos(anchor.heading - rig.yaw));
    rig.yaw += delta * (1 - Math.exp(-(dt * 0.9 + moved / TURN_DISTANCE)));
  }
  const omega = 5.5;
  camera.position.set(
    anchor.x + stepSpring(rig.x, -Math.cos(rig.yaw) * back, omega, dt),
    stepSpring(rig.y, height, 4, dt),
    anchor.z + stepSpring(rig.z, Math.sin(rig.yaw) * back, omega, dt),
  );
  const ahead = 7 + rig.speed * 0.35;
  rig.look.set(anchor.x + Math.cos(anchor.heading) * ahead, 1.15, anchor.z - Math.sin(anchor.heading) * ahead);
  camera.lookAt(rig.look);
  const pace = Math.min(1, rig.speed / TOP_SPEED);
  const fov = stepSpring(rig.fov, FOV + FOV_SPEED * pace * pace, 2.5, dt);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

/** Puts the field of view back to rest, for cameras that do not drive it. */
export function restoreFov(camera: THREE.PerspectiveCamera, fov = FOV): void {
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}
