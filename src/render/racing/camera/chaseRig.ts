import * as THREE from 'three';
import type { Spring } from '@/render/shared/interpolate';
import { stepSpring } from '@/render/shared/interpolate';
import type { RacingFrame } from '../sceneContext';
import { chaseAnchor, focusOwner, stepAnchor, type ChaseAnchor } from './chaseAnchor';

/** Field of view at rest and the extra degrees it opens up at top speed, for a sense of pace. */
const FOV = 50;
const FOV_SPEED = 9;
const TOP_SPEED = 35;
/** Meters of road over which the camera turns most of the way to the car's heading. */
const TURN_DISTANCE = 9;
/** Ground speed, m/s, at which the position springs run at their base rate; faster playback tightens them. */
const BASE_PACE = 25;

/** How fast the speed and acceleration the framing reads follow the car's, 1/s: they step once per snapshot otherwise. */
const SMOOTH_RATE = 3;

/**
 * Chase camera state between frames. It follows its own anchor (see
 * ChaseAnchor), never the car directly. The x and z springs hold the
 * camera's offset from that anchor, not its position.
 */
export interface ChaseRig {
  anchor: ChaseAnchor;
  x: Spring;
  y: Spring;
  z: Spring;
  fov: Spring;
  yaw: number;
  look: THREE.Vector3;
  /** Smoothed speed, m/s, and forward acceleration, m/s², of the car. */
  speed: number;
  accel: number;
  /** The anchor's smoothed ground speed in m per real second, which tightens the springs at fast playback. */
  pace: number;
}

export function chaseRig(): ChaseRig {
  const s = () => ({ value: 0, velocity: 0 });
  return { anchor: chaseAnchor(), x: s(), y: s(), z: s(), fov: { value: FOV, velocity: 0 }, yaw: 0, look: new THREE.Vector3(), speed: 0, accel: 0, pace: 0 };
}

/** Forgets where the camera was, so the next frame starts right behind the car. */
export function resetChase(rig: ChaseRig): void {
  rig.anchor.ready = false;
}

/**
 * A steady chase camera. It hangs behind its anchor on springs that hold
 * its offset, so a steady speed never drags it further back, whatever the
 * playback speed. It turns with the car per meter of road, so it trails
 * round a bend by the same amount at 1x or 4x and never cuts across the
 * infield. It backs off and widens its view as speed builds, and closes in
 * a little under braking. Nothing here reads the car's raw pose: a wobble
 * in the car, or a switch to another car, only moves the anchor, which
 * glides, so the picture never shakes.
 */
export function stepChase(rig: ChaseRig, frame: RacingFrame, camera: THREE.PerspectiveCamera, dt: number): void {
  const anchor = rig.anchor;
  const px = anchor.x;
  const pz = anchor.z;
  const snapped = stepAnchor(anchor, frame.focusPos.x, frame.focusPos.z, frame.focusYaw, focusOwner(frame), dt);
  const ease = 1 - Math.exp(-SMOOTH_RATE * dt);
  rig.speed = snapped ? frame.focusSpeed : rig.speed + (frame.focusSpeed - rig.speed) * ease;
  rig.accel = snapped ? 0 : rig.accel + (frame.motion.accelLong - rig.accel) * ease;
  const speed = rig.speed;
  const back = 8.4 + speed * 0.1 + THREE.MathUtils.clamp(rig.accel * 0.1, -1.4, 1.2);
  const ty = 2.55 + speed * 0.024;
  const moved = snapped ? 0 : Math.hypot(anchor.x - px, anchor.z - pz);
  if (snapped) {
    // A first frame, a restart or a car across the map: start right behind it instead of flying over.
    rig.yaw = anchor.heading;
    rig.x.value = -Math.cos(rig.yaw) * back;
    rig.z.value = Math.sin(rig.yaw) * back;
    rig.y.value = ty;
    rig.x.velocity = rig.y.velocity = rig.z.velocity = 0;
    rig.pace = 0;
  } else {
    const yawDelta = Math.atan2(Math.sin(anchor.heading - rig.yaw), Math.cos(anchor.heading - rig.yaw));
    rig.yaw += yawDelta * (1 - Math.exp(-(dt * 0.8 + moved / TURN_DISTANCE)));
  }
  rig.pace += (moved / Math.max(dt, 1e-3) - rig.pace) * (1 - Math.exp(-dt * 4));
  const omega = 6 * Math.max(1, rig.pace / BASE_PACE);
  const pace = Math.min(1, speed / TOP_SPEED);
  camera.position.set(
    anchor.x + stepSpring(rig.x, -Math.cos(rig.yaw) * back, omega, dt),
    stepSpring(rig.y, ty, 5, dt),
    anchor.z + stepSpring(rig.z, Math.sin(rig.yaw) * back, omega, dt),
  );
  // Aim down the anchor's heading, which leads the camera's: the car stays framed while the camera swings wide.
  const ahead = 6 + speed * 0.14;
  rig.look.set(anchor.x + Math.cos(anchor.heading) * ahead, 1.3, anchor.z - Math.sin(anchor.heading) * ahead);
  camera.lookAt(rig.look);
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
