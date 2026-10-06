import * as THREE from 'three';

/** Rays across the field of view. Enough that the cone's edge follows a box corner smoothly. */
export const WEDGE_SEGMENTS = 44;
const TRIS = 4 * WEDGE_SEGMENTS + 4;
const FLOOR_Y = 0.02;
const SIDES = [0, WEDGE_SEGMENTS];
const ATTRIBUTES = ['position', 'normal', 'aRadial', 'aFloor'];

/**
 * The seeker's vision as a solid wedge clipped by walls and boxes: a floor
 * fan, a top fan, the curved outer face and two side faces, rebuilt in
 * place every frame from one distance per ray. Built in the seeker's own
 * frame (apex at the origin, facing +x), so the caller only places it.
 */
export class VisionWedge {
  readonly geometry = new THREE.BufferGeometry();
  private readonly pos = new Float32Array(TRIS * 9);
  private readonly nor = new Float32Array(TRIS * 9);
  private readonly radial = new Float32Array(TRIS * 3);
  private readonly floor = new Float32Array(TRIS * 3);
  private v = 0;

  constructor(
    readonly fov: number,
    readonly range: number,
    readonly height: number,
  ) {
    const attr = (a: Float32Array, n: number) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', attr(this.pos, 3));
    this.geometry.setAttribute('normal', attr(this.nor, 3));
    this.geometry.setAttribute('aRadial', attr(this.radial, 1));
    this.geometry.setAttribute('aFloor', attr(this.floor, 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), range + height);
  }

  /** Local angle of ray k, left positive like every angle in the engine. */
  angle(k: number): number {
    return -this.fov / 2 + (this.fov * k) / WEDGE_SEGMENTS;
  }

  /** Rebuilds the wedge from WEDGE_SEGMENTS + 1 distances, m. */
  update(distances: Float32Array): void {
    this.v = 0;
    const top = this.height;
    for (let k = 0; k < WEDGE_SEGMENTS; k++) {
      const a0 = this.angle(k);
      const a1 = this.angle(k + 1);
      const d0 = distances[k];
      const d1 = distances[k + 1];
      const x0 = Math.cos(a0) * d0;
      const z0 = -Math.sin(a0) * d0;
      const x1 = Math.cos(a1) * d1;
      const z1 = -Math.sin(a1) * d1;
      const r0 = d0 / this.range;
      const r1 = d1 / this.range;
      this.tri(0, FLOOR_Y, 0, 0, x0, FLOOR_Y, z0, r0, x1, FLOOR_Y, z1, r1, 0, 1, 0, 1);
      this.tri(0, top, 0, 0, x0, top, z0, r0, x1, top, z1, r1, 0, 1, 0, 0);
      const mid = (a0 + a1) / 2;
      const nx = Math.cos(mid);
      const nz = -Math.sin(mid);
      this.tri(x0, FLOOR_Y, z0, r0, x1, FLOOR_Y, z1, r1, x1, top, z1, r1, nx, 0, nz, 0);
      this.tri(x0, FLOOR_Y, z0, r0, x1, top, z1, r1, x0, top, z0, r0, nx, 0, nz, 0);
    }
    for (let side = 0; side < SIDES.length; side++) {
      const k = SIDES[side];
      const a = this.angle(k);
      const d = distances[k];
      const x = Math.cos(a) * d;
      const z = -Math.sin(a) * d;
      const r = d / this.range;
      const nx = Math.sin(a);
      const nz = Math.cos(a);
      this.tri(0, FLOOR_Y, 0, 0, x, FLOOR_Y, z, r, x, top, z, r, nx, 0, nz, 0);
      this.tri(0, FLOOR_Y, 0, 0, x, top, z, r, 0, top, 0, 0, nx, 0, nz, 0);
    }
    for (let i = 0; i < ATTRIBUTES.length; i++) this.geometry.getAttribute(ATTRIBUTES[i]).needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
  }

  /** Writes one triangle: three (x, y, z, radial) corners sharing one normal and floor flag. */
  private tri(
    ax: number, ay: number, az: number, ar: number,
    bx: number, by: number, bz: number, br: number,
    cx: number, cy: number, cz: number, cr: number,
    nx: number, ny: number, nz: number, floor: number,
  ): void {
    const p = this.pos;
    const n = this.nor;
    const i = this.v;
    p[i * 3] = ax; p[i * 3 + 1] = ay; p[i * 3 + 2] = az;
    p[i * 3 + 3] = bx; p[i * 3 + 4] = by; p[i * 3 + 5] = bz;
    p[i * 3 + 6] = cx; p[i * 3 + 7] = cy; p[i * 3 + 8] = cz;
    for (let k = 0; k < 3; k++) {
      n[(i + k) * 3] = nx;
      n[(i + k) * 3 + 1] = ny;
      n[(i + k) * 3 + 2] = nz;
      this.floor[i + k] = floor;
    }
    this.radial[i] = ar;
    this.radial[i + 1] = br;
    this.radial[i + 2] = cr;
    this.v += 3;
  }
}
