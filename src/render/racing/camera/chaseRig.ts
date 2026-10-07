import * as THREE from 'three';
import type { Spring } from '@/render/shared/interpolate';
import { stepSpring } from '@/render/shared/interpolate';
import type { RacingFrame } from '../sceneContext';
import { SURFACE } from '../motion/wheelContact';

/** Field of view at rest and the extra degrees it opens up at top speed, for a sense of pace. */
const FOV = 50;
const FOV_SPEED = 9;
const TOP_SPEED = 35;

/** Chase camera state between frames. */
export interface ChaseRig {
  x: Spring;
  y: Spring;
  z: Spring;
  fov: Spring;
  yaw: number;
  t: number;
  init: boolean;
  look: THREE.Vector3;
}

export function chaseRig(): ChaseRig {
  const s = () => ({ value: 0, velocity: 0 });
  return { x: s(), y: s(), z: s(), fov: { value: FOV, velocity: 0 }, yaw: 0, t: 0, init: false, look: new THREE.Vector3() };
}

/** Smooth noise from a few incommensurate sines: a shake with no pattern and no allocation. */
function shake(t: number, seed: number): number {
  return Math.sin(t * 13.1 + seed) * 0.5 + Math.sin(t * 21.7 + seed * 2.3) * 0.32 + Math.sin(t * 34.3 + seed * 4.1) * 0.18;
}

/**
 * A chase camera with weight. It hangs behind the car on springs, so it
 * lags as the car pulls away, surges as it brakes and swings wide through
 * bends; it backs off and widens its view as speed builds; and it trembles
 * slightly at speed, more over kerbs and gravel. Everything is time based,
 * so it feels the same at any frame rate.
 */
export function stepChase(rig: ChaseRig, frame: RacingFrame, camera: THREE.PerspectiveCamera, dt: number): void {
  const focus = frame.focusPos;
  const speed = frame.focusSpeed;
  rig.t += dt;
  const yawDelta = Math.atan2(Math.sin(frame.focusYaw - rig.yaw), Math.cos(frame.focusYaw - rig.yaw));
  rig.yaw = rig.init ? rig.yaw + yawDelta * Math.min(1, dt * 3) : frame.focusYaw;
  const back = 8.4 + speed * 0.1;
  const tx = focus.x - Math.cos(rig.yaw) * back;
  const tz = focus.z + Math.sin(rig.yaw) * back;
  const ty = 2.55 + speed * 0.024;
  if (!rig.init || (rig.x.value - tx) ** 2 + (rig.z.value - tz) ** 2 > 60 * 60) {
    // Jump instead of flying across the map when the focus changes to a distant car.
    rig.init = true;
    rig.yaw = frame.focusYaw;
    rig.x.value = tx;
    rig.y.value = ty;
    rig.z.value = tz;
    rig.x.velocity = rig.y.velocity = rig.z.velocity = 0;
  }
  const pace = Math.min(1, speed / TOP_SPEED);
  let rough = 0;
  for (let w = 0; w < 4; w++) {
    const s = frame.contact.surface[w];
    rough = Math.max(rough, s === SURFACE.kerb ? 1 : s >= SURFACE.gravel ? 1.6 : 0);
  }
  const amp = (0.006 + 0.016 * pace * pace + 0.018 * rough * pace) * (speed > 1 ? 1 : 0);
  camera.position.set(
    stepSpring(rig.x, tx, 6, dt) + shake(rig.t, 1) * amp,
    stepSpring(rig.y, ty, 5, dt) + shake(rig.t, 7) * amp * 1.4,
    stepSpring(rig.z, tz, 6, dt) + shake(rig.t, 3) * amp,
  );
  const ahead = 6 + speed * 0.14;
  rig.look.set(focus.x + Math.cos(rig.yaw) * ahead, 1.3, focus.z - Math.sin(rig.yaw) * ahead);
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
