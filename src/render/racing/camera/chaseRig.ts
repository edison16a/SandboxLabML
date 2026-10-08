import * as THREE from 'three';
import type { Spring } from '@/render/shared/interpolate';
import { stepSpring } from '@/render/shared/interpolate';
import type { RacingFrame } from '../sceneContext';
import { SURFACE } from '../motion/wheelContact';

/** Field of view at rest and the extra degrees it opens up at top speed, for a sense of pace. */
const FOV = 50;
const FOV_SPEED = 9;
const TOP_SPEED = 35;
/** Meters of road over which the camera turns most of the way to the car's heading. */
const TURN_DISTANCE = 9;
/** Ground speed, m/s, at which the position springs run at their base rate; faster playback tightens them. */
const BASE_PACE = 25;

/** Chase camera state between frames. The x and z springs hold the camera's offset from the car, not its position. */
export interface ChaseRig {
  x: Spring;
  y: Spring;
  z: Spring;
  fov: Spring;
  yaw: number;
  t: number;
  init: boolean;
  look: THREE.Vector3;
  /** Where the car was last frame, to measure how far it went, and its smoothed ground speed in m per real second. */
  lastX: number;
  lastZ: number;
  pace: number;
}

export function chaseRig(): ChaseRig {
  const s = () => ({ value: 0, velocity: 0 });
  return { x: s(), y: s(), z: s(), fov: { value: FOV, velocity: 0 }, yaw: 0, t: 0, init: false, look: new THREE.Vector3(), lastX: 0, lastZ: 0, pace: 0 };
}

/** Smooth noise from a few incommensurate sines: a shake with no pattern and no allocation. */
function shake(t: number, seed: number): number {
  return Math.sin(t * 13.1 + seed) * 0.5 + Math.sin(t * 21.7 + seed * 2.3) * 0.32 + Math.sin(t * 34.3 + seed * 4.1) * 0.18;
}

/**
 * A chase camera with weight. It hangs behind the car on springs that hold
 * its offset from the car, so a steady speed never drags it further back,
 * whatever the playback speed. It turns with the car per meter of road, so
 * it trails round a bend by the same amount at 1x or 4x and never cuts
 * across the infield or out past the fence, and the springs tighten as
 * playback speeds up for the same reason. The car's
 * real acceleration gives it weight: it pulls away a little under power
 * and the camera closes in under braking. It backs off and widens its view
 * as speed builds, and trembles at speed, more over kerbs and gravel.
 */
export function stepChase(rig: ChaseRig, frame: RacingFrame, camera: THREE.PerspectiveCamera, dt: number): void {
  const focus = frame.focusPos;
  const speed = frame.focusSpeed;
  rig.t += dt;
  const moved = Math.hypot(focus.x - rig.lastX, focus.z - rig.lastZ);
  rig.lastX = focus.x;
  rig.lastZ = focus.z;
  const back = 8.4 + speed * 0.1 + THREE.MathUtils.clamp(frame.motion.accelLong * 0.1, -1.4, 1.2);
  const ty = 2.55 + speed * 0.024;
  // A new car, a restart or a long stall: start right behind it instead of flying across the map.
  if (!rig.init || moved > 60) {
    rig.init = true;
    rig.yaw = frame.focusYaw;
    rig.x.value = -Math.cos(rig.yaw) * back;
    rig.z.value = Math.sin(rig.yaw) * back;
    rig.y.value = ty;
    rig.x.velocity = rig.y.velocity = rig.z.velocity = 0;
    rig.pace = 0;
  } else {
    const yawDelta = Math.atan2(Math.sin(frame.focusYaw - rig.yaw), Math.cos(frame.focusYaw - rig.yaw));
    rig.yaw += yawDelta * (1 - Math.exp(-(dt * 0.8 + moved / TURN_DISTANCE)));
  }
  rig.pace += (moved / Math.max(dt, 1e-3) - rig.pace) * (1 - Math.exp(-dt * 4));
  const omega = 6 * Math.max(1, rig.pace / BASE_PACE);
  const pace = Math.min(1, speed / TOP_SPEED);
  let rough = 0;
  for (let w = 0; w < 4; w++) {
    const s = frame.contact.surface[w];
    rough = Math.max(rough, s === SURFACE.kerb ? 1 : s >= SURFACE.gravel ? 1.6 : 0);
  }
  const amp = (0.006 + 0.016 * pace * pace + 0.018 * rough * pace) * (speed > 1 ? 1 : 0);
  camera.position.set(
    focus.x + stepSpring(rig.x, -Math.cos(rig.yaw) * back, omega, dt) + shake(rig.t, 1) * amp,
    stepSpring(rig.y, ty, 5, dt) + shake(rig.t, 7) * amp * 1.4,
    focus.z + stepSpring(rig.z, Math.sin(rig.yaw) * back, omega, dt) + shake(rig.t, 3) * amp,
  );
  // Aim down the car's real heading, not the camera's lagging one: the car stays framed while the camera swings wide.
  const ahead = 6 + speed * 0.14;
  rig.look.set(focus.x + Math.cos(frame.focusYaw) * ahead, 1.3, focus.z - Math.sin(frame.focusYaw) * ahead);
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
