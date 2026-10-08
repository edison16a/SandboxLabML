import * as THREE from 'three';
import { ATMOSPHERE, hazeUniforms, SUN_DIR } from '../world/atmosphere';
import { PARTICLE_FRAGMENT, PARTICLE_VERTEX } from './particleShaders';

/** Sky and ground light for the puffs, the hemisphere light's own colors. */
const SKY = new THREE.Color('#bcd4f2');
const GROUND = new THREE.Color('#8a6c42');

/** How a kind of particle lives: tint, lifetime (s), size over life (m), opacity, buoyancy, drag and softness. */
export interface ParticleKind {
  color: THREE.Color;
  life: number;
  size0: number;
  size1: number;
  alpha: number;
  /** Upward acceleration, m/s^2; negative falls like grit. */
  lift: number;
  /** Fraction of velocity lost per second. */
  drag: number;
  /** 1 for a soft puff, 0 for a hard fleck of grit. */
  soft: number;
}

/**
 * A pool of camera facing particles for tire smoke, dust and flying grit,
 * simulated on the CPU (position, velocity, drag, buoyancy, growth) and
 * drawn in one instanced call. Fixed size: when it is full the oldest
 * particle is reused, so nothing is ever allocated after start up.
 */
export class Particles {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly state: Float32Array;
  private readonly kinds: ParticleKind[] = [];
  private readonly kindOf: Int8Array;
  /** Live particles this frame and their distance from the camera, for drawing far to near. */
  private readonly order: Uint16Array;
  private readonly depth: Float32Array;
  private readonly offset: THREE.InstancedBufferAttribute;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly color: THREE.InstancedBufferAttribute;
  private next = 0;

  /** Floats per particle: x, y, z, vx, vy, vz, age, life, seed. */
  private static readonly F = 9;

  constructor(private readonly capacity: number, noise: THREE.Texture) {
    this.state = new Float32Array(capacity * Particles.F);
    this.kindOf = new Int8Array(capacity).fill(-1);
    this.order = new Uint16Array(capacity);
    this.depth = new Float32Array(capacity);
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.attributes.position);
    this.geometry.setAttribute('uv', quad.attributes.uv);
    const make = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(THREE.DynamicDrawUsage);
    this.offset = make(3);
    this.look = make(4);
    this.color = make(3);
    this.geometry.setAttribute('aOffset', this.offset);
    this.geometry.setAttribute('aLook', this.look);
    this.geometry.setAttribute('aColor', this.color);
    this.geometry.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      uniforms: { ...hazeUniforms, uNoise: { value: noise }, uSunColor: { value: ATMOSPHERE.sun }, uSkyColor: { value: SKY }, uGroundColor: { value: GROUND }, uSunDir: { value: SUN_DIR } },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  /** Registers a particle kind and returns its id for `spawn`. */
  kind(k: ParticleKind): number {
    this.kinds.push(k);
    return this.kinds.length - 1;
  }

  spawn(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, seed: number): void {
    const i = this.next;
    this.next = (i + 1) % this.capacity;
    const s = this.state;
    const o = i * Particles.F;
    s[o] = x; s[o + 1] = y; s[o + 2] = z;
    s[o + 3] = vx; s[o + 4] = vy; s[o + 5] = vz;
    s[o + 6] = 0;
    s[o + 7] = this.kinds[kind].life * (0.75 + seed * 0.5);
    s[o + 8] = seed;
    this.kindOf[i] = kind;
  }

  /**
   * Moves every live particle on by `dt`, then packs the live ones into the
   * draw buffers from far to near as seen from `eye`, so overlapping puffs
   * blend in the right order. An insertion sort over a few hundred
   * particles that are mostly in order already from the last frame.
   */
  update(dt: number, eye: THREE.Vector3): void {
    const s = this.state;
    let live = 0;
    for (let i = 0; i < this.capacity; i++) {
      const k = this.kindOf[i];
      if (k < 0) continue;
      const o = i * Particles.F;
      s[o + 6] += dt;
      if (s[o + 6] >= s[o + 7]) {
        this.kindOf[i] = -1;
        continue;
      }
      const kind = this.kinds[k];
      const keep = Math.max(0, 1 - kind.drag * dt);
      s[o + 3] *= keep;
      s[o + 5] *= keep;
      s[o + 4] = s[o + 4] * keep + kind.lift * dt;
      s[o] += s[o + 3] * dt;
      s[o + 1] = Math.max(0.05, s[o + 1] + s[o + 4] * dt);
      s[o + 2] += s[o + 5] * dt;
      const d = (s[o] - eye.x) ** 2 + (s[o + 1] - eye.y) ** 2 + (s[o + 2] - eye.z) ** 2;
      // Insert by distance, farthest first.
      let j = live++;
      while (j > 0 && this.depth[j - 1] < d) {
        this.depth[j] = this.depth[j - 1];
        this.order[j] = this.order[j - 1];
        j--;
      }
      this.depth[j] = d;
      this.order[j] = i;
    }
    this.pack(live);
  }

  /** Writes the live particles to the instance buffers in draw order. */
  private pack(live: number): void {
    const s = this.state;
    const off = this.offset.array as Float32Array;
    const look = this.look.array as Float32Array;
    const col = this.color.array as Float32Array;
    for (let n = 0; n < live; n++) {
      const i = this.order[n];
      const o = i * Particles.F;
      const kind = this.kinds[this.kindOf[i]];
      const t = s[o + 6] / s[o + 7];
      off[n * 3] = s[o];
      off[n * 3 + 1] = s[o + 1];
      off[n * 3 + 2] = s[o + 2];
      // Puffs swell fast then slowly; they fade in over the first tenth of their life and out over the rest.
      look[n * 4] = kind.size0 + (kind.size1 - kind.size0) * Math.sqrt(t);
      look[n * 4 + 1] = kind.alpha * Math.min(1, t * 10) * (1 - t) * (1 - t);
      look[n * 4 + 2] = s[o + 8] + t * 0.08;
      look[n * 4 + 3] = kind.soft;
      kind.color.toArray(col, n * 3);
    }
    this.geometry.instanceCount = live;
    this.offset.needsUpdate = this.look.needsUpdate = this.color.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
