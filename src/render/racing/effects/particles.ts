import * as THREE from 'three';

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

const vertex = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aLook;
attribute vec3 aColor;
varying vec2 vUv;
varying float vAlpha;
varying float vSoft;
varying vec3 vColor;
varying float vSeed;
void main() {
  vUv = uv;
  vAlpha = aLook.y;
  vSoft = aLook.w;
  vColor = aColor;
  vSeed = aLook.z;
  // Face the camera: build the quad from the view's right and up axes, turned by the particle's spin.
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(aLook.z * 6.28);
  float s = sin(aLook.z * 6.28);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aLook.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(aOffset + right * p.x + up * p.y, 1.0);
}
`;

const fragment = /* glsl */ `
uniform sampler2D uNoise;
varying vec2 vUv;
varying float vAlpha;
varying float vSoft;
varying vec3 vColor;
varying float vSeed;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float n = texture2D(uNoise, vUv * 0.6 + vSeed * 3.1).g;
  float puff = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.7);
  float a = mix(step(r, 0.85), puff, vSoft) * vAlpha;
  if (a < 0.004) discard;
  // Lit from above: the top of each puff catches the sun, the underside sits in its own shade.
  vec3 col = vColor * (0.72 + 0.45 * vUv.y);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

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
  private readonly offset: THREE.InstancedBufferAttribute;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly color: THREE.InstancedBufferAttribute;
  private next = 0;

  /** Floats per particle: x, y, z, vx, vy, vz, age, life, seed. */
  private static readonly F = 9;

  constructor(private readonly capacity: number, noise: THREE.Texture) {
    this.state = new Float32Array(capacity * Particles.F);
    this.kindOf = new Int8Array(capacity).fill(-1);
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
    this.material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { uNoise: { value: noise } }, transparent: true, depthWrite: false });
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

  /** Moves every live particle on by `dt` and repacks the live ones into the draw buffers. */
  update(dt: number): void {
    const s = this.state;
    const off = this.offset.array as Float32Array;
    const look = this.look.array as Float32Array;
    const col = this.color.array as Float32Array;
    let live = 0;
    for (let i = 0; i < this.capacity; i++) {
      const k = this.kindOf[i];
      if (k < 0) continue;
      const o = i * Particles.F;
      s[o + 6] += dt;
      const t = s[o + 6] / s[o + 7];
      if (t >= 1) {
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
      off[live * 3] = s[o]; off[live * 3 + 1] = s[o + 1]; off[live * 3 + 2] = s[o + 2];
      // Puffs swell fast then slowly; they fade in over the first tenth of their life and out over the rest.
      look[live * 4] = kind.size0 + (kind.size1 - kind.size0) * Math.sqrt(t);
      look[live * 4 + 1] = kind.alpha * Math.min(1, t * 10) * (1 - t) * (1 - t);
      look[live * 4 + 2] = s[o + 8] + t * 0.08;
      look[live * 4 + 3] = kind.soft;
      kind.color.toArray(col, live * 3);
      live++;
    }
    this.geometry.instanceCount = live;
    this.offset.needsUpdate = this.look.needsUpdate = this.color.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
