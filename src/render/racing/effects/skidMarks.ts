import * as THREE from 'three';

/** Rubber mark width, m: about a tire's tread. */
const WIDTH = 0.24;
/** Seconds a mark takes to weather away. */
const LIFE = 24;

const vertex = /* glsl */ `
attribute float birth;
attribute float strength;
attribute float side;
uniform float uNow;
varying float vAlpha;
varying float vSide;
void main() {
  vSide = side;
  float age = uNow - birth;
  vAlpha = strength * (1.0 - smoothstep(${(LIFE * 0.4).toFixed(1)}, ${LIFE.toFixed(1)}, age));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = /* glsl */ `
varying float vAlpha;
varying float vSide;
void main() {
  // Soft edges across the mark, the way rubber smears at the sides of a tread.
  float edge = smoothstep(0.0, 0.3, vSide) * smoothstep(1.0, 0.7, vSide);
  gl_FragColor = vec4(0.025, 0.025, 0.028, vAlpha * edge);
}
`;

/**
 * Dark rubber laid by sliding tires: continuous strips, one per wheel,
 * from a ring of segments that reuses the oldest. Each vertex knows when
 * it was laid, so fading costs nothing on the CPU: the shader weathers
 * marks away with time.
 */
export class SkidMarks {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly pos: THREE.BufferAttribute;
  private readonly birth: THREE.BufferAttribute;
  private readonly strength: THREE.BufferAttribute;
  private next = 0;

  constructor(private readonly segments = 1600) {
    const g = new THREE.BufferGeometry();
    const n = segments * 6;
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.birth = new THREE.BufferAttribute(new Float32Array(n).fill(-1e6), 1).setUsage(THREE.DynamicDrawUsage);
    this.strength = new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    const side = new Float32Array(n);
    for (let s = 0; s < segments; s++) side.set([0, 1, 0, 0, 1, 1], s * 6);
    g.setAttribute('position', this.pos);
    g.setAttribute('birth', this.birth);
    g.setAttribute('strength', this.strength);
    g.setAttribute('side', new THREE.BufferAttribute(side, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uNow: { value: 0 } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -6,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /**
   * Lays one segment from (ax, az) to (bx, bz) at `now` seconds with an
   * opacity, as a quad of the tread's width across the direction of travel.
   */
  add(ax: number, az: number, bx: number, bz: number, alpha: number, now: number): void {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) return;
    const nx = (-dz / len) * WIDTH * 0.5;
    const nz = (dx / len) * WIDTH * 0.5;
    const y = 0.03;
    const p = this.pos.array as Float32Array;
    const o = this.next * 18;
    // Two triangles: (a-, a+, b-) and (b-, a+, b+), matching the side pattern set up front.
    p[o] = ax - nx; p[o + 1] = y; p[o + 2] = az - nz;
    p[o + 3] = ax + nx; p[o + 4] = y; p[o + 5] = az + nz;
    p[o + 6] = bx - nx; p[o + 7] = y; p[o + 8] = bz - nz;
    p[o + 9] = bx - nx; p[o + 10] = y; p[o + 11] = bz - nz;
    p[o + 12] = ax + nx; p[o + 13] = y; p[o + 14] = az + nz;
    p[o + 15] = bx + nx; p[o + 16] = y; p[o + 17] = bz + nz;
    const b = this.birth.array as Float32Array;
    const s = this.strength.array as Float32Array;
    for (let k = 0; k < 6; k++) {
      b[this.next * 6 + k] = now;
      s[this.next * 6 + k] = alpha;
    }
    // Upload only the segment that changed, not the whole ring.
    this.pos.addUpdateRange(o, 18);
    this.birth.addUpdateRange(this.next * 6, 6);
    this.strength.addUpdateRange(this.next * 6, 6);
    this.pos.needsUpdate = this.birth.needsUpdate = this.strength.needsUpdate = true;
    this.next = (this.next + 1) % this.segments;
  }

  /** Clears every mark, for a new track or episode. */
  clear(): void {
    (this.birth.array as Float32Array).fill(-1e6);
    this.birth.clearUpdateRanges();
    this.birth.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
