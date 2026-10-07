import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Flight } from './flight';
import { FOLLOW, FollowCam, type FollowTarget } from './followCam';
import { sightBlocked } from './occlusion';

/** A wall 0.9 m in front of the agent on the +z side, where the follow camera starts. */
const NEAR_WALL = [{ x: 0, z: 1, hx: 5, hz: 0.1 }];

function rig(walls: FollowTarget['walls']) {
  const camera = new THREE.PerspectiveCamera(42, 1.3, 0.1, 500);
  const controls = { target: new THREE.Vector3(), update: () => {} };
  const flight = new Flight();
  const cam = new FollowCam();
  const target: FollowTarget = { key: 1, x: 0, z: 0, elevation: 0, ox: 0, oz: 0, epoch: 0, walls };
  const run = (seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) {
      cam.update(camera, controls, flight, target, 1 / 60, 1);
      if (flight.t < 1) flight.step(camera, controls, 1 / 60);
    }
  };
  const hidden = () => sightBlocked(0, 1.05, 0, camera.position.x, camera.position.y, camera.position.z, target.walls, 2.5);
  return { camera, cam, target, run, hidden };
}

describe('FollowCam', () => {
  it('opens on a side of the agent no wall hides', () => {
    const r = rig(NEAR_WALL);
    r.run(0.1);
    expect(r.hidden()).toBe(false);
  });

  it('swings round a wall that comes between it and the agent, but not while you hold the orbit', () => {
    const r = rig([]);
    r.run(0.5);
    expect(r.hidden()).toBe(false);
    r.target.walls = NEAR_WALL;
    expect(r.hidden()).toBe(true);
    r.cam.dragging = true;
    r.run(1);
    expect(r.hidden()).toBe(true);
    r.cam.dragging = false;
    r.run(3);
    expect(r.hidden()).toBe(false);
    // It keeps its distance while it swings.
    expect(r.camera.position.distanceTo(new THREE.Vector3(0, FOLLOW.height, 0))).toBeCloseTo(FOLLOW.distance, 0);
  });
});
