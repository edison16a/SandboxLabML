import * as THREE from 'three';
import { NAV_COLORS } from '../palette';

/** Seconds a piece of confetti lives, and the last share of it spent fading. */
const LIFE = 2.8;
/** Gentle gravity and strong air drag, so paper floats rather than falls, m/s² and 1/s. */
const GRAVITY = 4.2;
const DRAG = 1.6;
const COLORS = [NAV_COLORS.runner, NAV_COLORS.cube, '#ffffff', '#ff7a6b', NAV_COLORS.goalArrow].map((c) => new THREE.Color(c));

/**
 * A cloud of confetti as one instanced mesh of small paper squares. Each
 * piece flies, tumbles and drifts down on its own; the cloud fades out as
 * a whole. Typed arrays only, so a burst allocates nothing.
 */
export class ConfettiCloud {
  readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly spin: Float32Array;
  private readonly axis: Float32Array;
  private age = LIFE;
  private seed = 1;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly a = new THREE.Vector3();

  constructor(readonly count: number) {
    const g = new THREE.PlaneGeometry(0.09, 0.06);
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 1, emissive: '#ffffff', emissiveIntensity: 0.12 });
    this.mesh = new THREE.InstancedMesh(g, this.material, count);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.spin = new Float32Array(count);
    this.axis = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, COLORS[i % COLORS.length]);
  }

  /** A cheap repeatable random number, so bursts differ without Math.random. */
  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Throws a fresh cloud from the beam at height y over (x, z), spread across the gate up to `reach` m either side. */
  burst(x: number, y: number, z: number, reach: number): void {
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      this.pos[o] = x + (this.rand() - 0.5) * 0.4;
      this.pos[o + 1] = y;
      this.pos[o + 2] = Math.max(-reach, Math.min(reach, z + (this.rand() - 0.5) * 5));
      const up = 1.5 + this.rand() * 3.2;
      this.vel[o] = (this.rand() - 0.5) * 4.5;
      this.vel[o + 1] = up;
      this.vel[o + 2] = (this.rand() - 0.5) * 4.5;
      this.spin[i] = 6 + this.rand() * 10;
      this.a.set(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5).normalize();
      this.axis[o] = this.a.x;
      this.axis[o + 1] = this.a.y;
      this.axis[o + 2] = this.a.z;
    }
    this.age = 0;
    this.mesh.visible = true;
  }

  clear(): void {
    this.age = LIFE;
    this.mesh.visible = false;
  }

  /** Advances the cloud by `dt` seconds of simulation. */
  step(dt: number): void {
    if (this.age >= LIFE) return;
    this.age += dt;
    if (this.age >= LIFE) {
      this.mesh.visible = false;
      return;
    }
    const keep = Math.exp(-DRAG * dt);
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      this.vel[o] *= keep;
      this.vel[o + 1] = this.vel[o + 1] * keep - GRAVITY * dt;
      this.vel[o + 2] *= keep;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] = Math.max(0.01, this.pos[o + 1] + this.vel[o + 1] * dt);
      this.pos[o + 2] += this.vel[o + 2] * dt;
      this.a.set(this.axis[o], this.axis[o + 1], this.axis[o + 2]);
      this.q.setFromAxisAngle(this.a, this.age * this.spin[i]);
      this.v.set(this.pos[o], this.pos[o + 1], this.pos[o + 2]);
      this.mesh.setMatrixAt(i, this.m.compose(this.v, this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.material.opacity = Math.min(1, (LIFE - this.age) / (LIFE * 0.3));
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
