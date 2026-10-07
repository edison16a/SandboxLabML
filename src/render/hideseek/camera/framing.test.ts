import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARENA_SPAN, latticeFor } from '../layout/gridLattice';
import { presetShot, shotKey } from './cameraViews';
import { arenaShot, closeShot, type Shot } from './framing';

const FOV = 42;
const ASPECT = 1.35;

/** Where a floor point lands on screen from a shot, in normalized device coordinates. */
function project(shot: Shot, x: number, y: number, z: number): THREE.Vector3 {
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 1000);
  cam.position.set(shot.px, shot.py, shot.pz);
  cam.lookAt(shot.tx, shot.ty, shot.tz);
  cam.updateMatrixWorld();
  return new THREE.Vector3(x, y, z).project(cam);
}

describe('camera framing', () => {
  it('frames the close shot as a three quarter view about 50 degrees up', () => {
    const s = closeShot(0, 0, ARENA_SPAN, FOV, ASPECT);
    const flat = Math.hypot(s.px, s.pz);
    expect((Math.atan2(s.py, flat) * 180) / Math.PI).toBeCloseTo(50, 0);
    // Turned off the room's axis, so walls and crates read as solid.
    expect(Math.abs(s.px)).toBeGreaterThan(2);
  });

  it('fills the viewport with the room in the close shot and keeps the middle of the room in view', () => {
    const s = closeShot(0, 0, ARENA_SPAN, FOV, ASPECT);
    for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, 0]]) {
      const p = project(s, x, 0, z);
      expect(Math.abs(p.x)).toBeLessThan(1);
      expect(Math.abs(p.y)).toBeLessThan(1);
    }
    // Close means close: the overview stands well back from it.
    const far = arenaShot(0, 0, ARENA_SPAN, FOV, ASPECT, false);
    expect(Math.hypot(s.px, s.py, s.pz)).toBeLessThan(Math.hypot(far.px, far.py, far.pz) * 0.85);
  });

  it('keeps the top down shot straight over the focused arena', () => {
    const s = presetShot('top', { x: 30, z: -12 }, latticeFor(9, ASPECT), ARENA_SPAN, FOV, ASPECT);
    expect(s.px).toBeCloseTo(30, 1);
    expect(s.pz).toBeCloseTo(-12, 0);
    expect(s.py).toBeGreaterThan(20);
  });

  it('frames the whole grid when no arena is focused, in every set view', () => {
    const lattice = latticeFor(50, ASPECT);
    for (const view of ['close', 'overview', 'top'] as const) {
      const s = presetShot(view, null, lattice, ARENA_SPAN, FOV, ASPECT);
      const corner = project(s, lattice.width / 2, 0, lattice.depth / 2);
      expect(Math.abs(corner.x)).toBeLessThan(1);
      expect(Math.abs(corner.y)).toBeLessThan(1);
    }
  });

  it('gives every view, focus and grid its own shot key', () => {
    const keys = new Set([shotKey('close', 0, 1, 1), shotKey('overview', 0, 1, 1), shotKey('close', 3, 9, 3), shotKey('close', -1, 9, 3), shotKey('close', -1, 25, 5)]);
    expect(keys.size).toBe(5);
  });
});
