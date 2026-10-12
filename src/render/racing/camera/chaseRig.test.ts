import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFrame } from '../sceneContext';
import { chaseRig, stepChase } from './chaseRig';

/**
 * Drives a car round a circle of radius `r` (0 for a straight line) at
 * `ground` meters per real second while the simulation reports `sim` m/s,
 * as 4x playback does, and returns the camera's last position and the car's.
 */
function drive(r: number, ground: number, sim: number, frames = 900, dt = 1 / 60) {
  const frame = createFrame();
  const rig = chaseRig();
  const camera = new THREE.PerspectiveCamera(50, 1.6, 0.5, 6000);
  frame.focusSpeed = sim;
  let s = 0;
  for (let k = 0; k < frames; k++) {
    s += ground * dt;
    if (r > 0) {
      const a = s / r;
      // Counterclockwise seen from above in sim coordinates (x, y), drawn at world (x, -y).
      frame.focusPos.set(Math.cos(a) * r, 0, -Math.sin(a) * r);
      frame.focusYaw = a + Math.PI / 2;
    } else {
      frame.focusPos.set(s, 0, 0);
      frame.focusYaw = 0;
    }
    stepChase(rig, frame, camera, dt);
  }
  return { cam: camera.position.clone(), car: frame.focusPos.clone() };
}

describe('the chase camera', () => {
  it('holds its distance behind a car at a steady speed, at 1x or 4x playback', () => {
    for (const ground of [25, 100]) {
      const { cam, car } = drive(0, ground, 25);
      expect(Math.hypot(cam.x - car.x, cam.z - car.z)).toBeCloseTo(8.4 + 2.5, 0);
    }
  });

  it('lags round a bend by about the same at 1x and 4x, staying near the line the car drove', () => {
    // How far the camera sits off the car's circle, m: it trails along the bend, so a little inside.
    const off = (ground: number) => {
      const { cam } = drive(40, ground, 25);
      return Math.hypot(cam.x, cam.z) - 40;
    };
    const slow = off(25);
    const fast = off(100);
    expect(Math.abs(slow)).toBeLessThan(4);
    expect(Math.abs(fast - slow)).toBeLessThan(1);
  });

  it('stays smooth when the car wobbles, and glides when the lead passes to another car', () => {
    const frame = createFrame();
    const rig = chaseRig();
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.5, 6000);
    frame.focusSpeed = 25;
    frame.focusIndex = 0;
    frame.focusStream = 'population';
    const dt = 1 / 60;
    let shake = 0;
    let fastest = 0;
    let last = 0;
    let lastStep = 0;
    for (let k = 0; k < 600; k++) {
      // A small heading and position flicker every frame, then a hand over to a car 3 m to the side halfway through.
      const side = k >= 300 ? 3 : 0;
      if (k === 300) frame.focusIndex = 1;
      frame.focusPos.set(k * 25 * dt, 0, side + (k % 2 ? 0.08 : -0.08));
      frame.focusYaw = k % 2 ? 0.03 : -0.03;
      stepChase(rig, frame, camera, dt);
      const step = camera.position.z - last;
      // How much the sideways step changes from one frame to the next: zero for an even path.
      if (k > 60 && k < 300) shake = Math.max(shake, Math.abs(step - lastStep));
      if (k > 60) fastest = Math.max(fastest, Math.abs(step));
      lastStep = step;
      last = camera.position.z;
    }
    // A 16 cm flicker in the car moves the camera by a couple of millimeters at most. Bolted to the car, it moved 16 cm.
    expect(shake).toBeLessThan(0.003);
    // The hand over is a glide of a few centimeters a frame, never a cut, and it arrives.
    expect(fastest).toBeLessThan(0.15);
    expect(camera.position.z).toBeCloseTo(3, 1);
  });
});
