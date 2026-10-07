import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { solveTwoBone } from './ik';
import { driveSpring, spring } from './spring';
import { distance, rotateBody, vec3 } from './vec';

describe('driveSpring', () => {
  it('moves the same at 30 and at 144 frames a second', () => {
    const run = (fps: number) => {
      const s = spring(0);
      for (let t = 0; t < 0.5; t += 1 / fps) driveSpring(s, 1, 12, 0.5, 1 / fps);
      return s.value;
    };
    expect(Math.abs(run(30) - run(144))).toBeLessThan(0.03);
  });

  it('never overshoots when critically damped, and wobbles past the target when underdamped', () => {
    const peak = (zeta: number) => {
      const s = spring(0);
      let most = 0;
      for (let i = 0; i < 120; i++) most = Math.max(most, driveSpring(s, 1, 10, zeta, 1 / 60));
      return most;
    };
    expect(peak(1)).toBeLessThanOrEqual(1.0001);
    expect(peak(0.4)).toBeGreaterThan(1.1);
  });
});

describe('solveTwoBone', () => {
  const root = vec3(0, 1, 0);
  const pole = vec3(1, 0, 0);

  it('reaches a target in range with bones of the right length, bent toward the pole', () => {
    const mid = vec3();
    const end = vec3();
    const target = vec3(0.1, 0.45, 0.05);
    solveTwoBone(root, target, 0.3, 0.3, pole, mid, end);
    expect(distance(end, target)).toBeLessThan(1e-6);
    expect(distance(root, mid)).toBeCloseTo(0.3, 6);
    expect(distance(mid, end)).toBeCloseTo(0.3, 6);
    expect(mid.x).toBeGreaterThan(0.1);
  });

  it('points straight at a target out of reach', () => {
    const mid = vec3();
    const end = vec3();
    solveTwoBone(root, vec3(0, -2, 0), 0.3, 0.3, pole, mid, end);
    expect(end.y).toBeCloseTo(1 - 0.6, 2);
    expect(Math.abs(end.x)).toBeLessThan(1e-6);
  });
});

describe('rotateBody', () => {
  it('turns points exactly as the bone Euler does', () => {
    const [lean, roll, twist] = [0.3, -0.2, 0.7];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(roll, twist, -lean, 'YXZ'));
    for (const p of [vec3(0, 1, 0), vec3(0.2, 0.35, 0.18), vec3(-0.1, 0, -0.3)]) {
      const expected = new THREE.Vector3(p.x, p.y, p.z).applyQuaternion(q);
      const got = rotateBody(p, lean, roll, twist, vec3());
      expect(got.x).toBeCloseTo(expected.x, 6);
      expect(got.y).toBeCloseTo(expected.y, 6);
      expect(got.z).toBeCloseTo(expected.z, 6);
    }
  });

  it('leans the top of the body forward for a positive lean', () => {
    expect(rotateBody(vec3(0, 1, 0), 0.3, 0, 0, vec3()).x).toBeGreaterThan(0.25);
  });
});
