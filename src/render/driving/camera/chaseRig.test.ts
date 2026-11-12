import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFrame } from '../frame/sceneContext';
import { chaseRig, stepChase } from './chaseRig';

const DT = 1 / 60;

/** A chase camera and the frame it reads, with the followed SUV at a steady speed. */
function setup(speed: number) {
  const frame = createFrame();
  frame.speed = speed;
  frame.focus = 0;
  return { frame, rig: chaseRig(), camera: new THREE.PerspectiveCamera(52, 1.6, 0.3, 4000) };
}

/** The chase camera rides its own springs, so it never shakes with what it follows. */
describe('the chase camera', () => {
  it('holds its distance behind an SUV at a steady speed', () => {
    const { frame, rig, camera } = setup(12);
    for (let k = 0; k < 900; k++) {
      frame.pos.set(k * 12 * DT, 0, 0);
      stepChase(rig, frame, camera, DT);
    }
    const behind = frame.pos.x - camera.position.x;
    // 8.6 m at rest and 0.12 m more per m/s of speed.
    expect(behind).toBeCloseTo(8.6 + 12 * 0.12, 0);
    expect(Math.abs(camera.position.z)).toBeLessThan(0.01);
  });

  it('stays smooth when the SUV wobbles, and glides when the lead passes to another SUV', () => {
    const { frame, rig, camera } = setup(12);
    let shake = 0;
    let fastest = 0;
    let last = 0;
    let lastStep = 0;
    for (let k = 0; k < 600; k++) {
      // A small heading and position flicker every frame, then a hand over to an SUV a lane over halfway through.
      const side = k >= 300 ? 3 : 0;
      if (k === 300) frame.focus = 1;
      frame.pos.set(k * 12 * DT, 0, side + (k % 2 ? 0.08 : -0.08));
      frame.yaw = k % 2 ? 0.03 : -0.03;
      stepChase(rig, frame, camera, DT);
      const step = camera.position.z - last;
      // How much the sideways step changes from one frame to the next: zero for an even path.
      if (k > 60 && k < 300) shake = Math.max(shake, Math.abs(step - lastStep));
      if (k > 60) fastest = Math.max(fastest, Math.abs(step));
      lastStep = step;
      last = camera.position.z;
    }
    // A 16 cm flicker in the SUV moves the camera by a few millimeters at most.
    expect(shake).toBeLessThan(0.005);
    // The hand over is a glide of a few centimeters a frame, never a cut, and it arrives.
    expect(fastest).toBeLessThan(0.15);
    expect(camera.position.z).toBeCloseTo(3, 1);
  });

  it('starts right behind the SUV on a new episode instead of flying across town', () => {
    const { frame, rig, camera } = setup(10);
    for (let k = 0; k < 120; k++) {
      frame.pos.set(k * 10 * DT, 0, 0);
      stepChase(rig, frame, camera, DT);
    }
    frame.epoch++;
    frame.pos.set(400, 0, -300);
    stepChase(rig, frame, camera, DT);
    expect(Math.hypot(camera.position.x - 400, camera.position.z + 300)).toBeLessThan(12);
  });
});
