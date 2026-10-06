import * as THREE from 'three';

/** Samples kept: about 1.5 s of movement at 30 snapshots a second. */
const SAMPLES = 46;
/** Minimum travel before a new sample is taken, m, so a still agent leaves no smear. */
const MIN_STEP = 0.07;
const WIDTH = 0.34;
const Y = 0.016;

/**
 * A short ribbon on the floor behind an agent, fading out with age. Every
 * buffer is allocated once and rewritten in place, and the newest point
 * follows the interpolated agent each frame, so the ribbon never lags.
 */
export class MotionTrail {
  readonly mesh: THREE.Mesh;
  private readonly xs = new Float32Array(SAMPLES);
  private readonly zs = new Float32Array(SAMPLES);
  private filled = 0;
  private readonly pos: THREE.BufferAttribute;
  private readonly col: THREE.BufferAttribute;
  private readonly color = new THREE.Color();

  constructor(color: THREE.Color) {
    this.color.copy(color);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('color', this.col);
    const index: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i++) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    g.setIndex(index);
    g.setDrawRange(0, 0);
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.raycast = () => {};
  }

  /** Forgets the path, e.g. when a new match starts and the agent jumps to its spawn. */
  reset(): void {
    this.filled = 0;
  }

  /**
   * Moves the head to (x, z). Once the head is far enough from the newest
   * kept sample, the previous head is kept as a sample, so samples end up
   * about MIN_STEP apart however fast the agent moves.
   */
  update(x: number, z: number, brightness: number): void {
    if (this.filled === 0) {
      this.filled = 1;
    } else {
      const anchor = this.filled > 1 ? 1 : 0;
      if (Math.hypot(x - this.xs[anchor], z - this.zs[anchor]) > MIN_STEP) {
        this.xs.copyWithin(1, 0, SAMPLES - 1);
        this.zs.copyWithin(1, 0, SAMPLES - 1);
        this.filled = Math.min(SAMPLES, this.filled + 1);
      }
    }
    this.xs[0] = x;
    this.zs[0] = z;
    this.write(brightness);
  }

  private write(brightness: number): void {
    const n = this.filled;
    const p = this.pos.array as Float32Array;
    const c = this.col.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let dx = this.xs[a] - this.xs[b];
      let dz = this.zs[a] - this.zs[b];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const age = i / (SAMPLES - 1);
      const w = (WIDTH / 2) * (1 - age * 0.7);
      const o = i * 6;
      p[o] = this.xs[i] - dz * w;
      p[o + 1] = Y;
      p[o + 2] = this.zs[i] + dx * w;
      p[o + 3] = this.xs[i] + dz * w;
      p[o + 4] = Y;
      p[o + 5] = this.zs[i] - dx * w;
      const alpha = (1 - age) ** 1.6 * 0.55 * brightness;
      for (let side = 0; side < 2; side++) {
        const q = i * 8 + side * 4;
        c[q] = this.color.r;
        c[q + 1] = this.color.g;
        c[q + 2] = this.color.b;
        c[q + 3] = alpha;
      }
    }
    this.mesh.geometry.setDrawRange(0, Math.max(0, n - 1) * 6);
    this.pos.needsUpdate = this.col.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
