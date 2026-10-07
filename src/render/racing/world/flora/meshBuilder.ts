import * as THREE from 'three';

/**
 * Collects vertices with their own normals and colors, then hands back a
 * BufferGeometry. Tree crowns want hand set normals (pointing out from the
 * crown, not from each facet) so they shade as soft volumes, which three's
 * stock geometries cannot give.
 */
export class MeshBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  /** Adds a vertex and returns its index. */
  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color): number {
    const len = Math.hypot(nx, ny, nz) || 1;
    this.pos.push(x, y, z);
    this.nrm.push(nx / len, ny / len, nz / len);
    this.col.push(c.r, c.g, c.b);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /**
   * A tapered cylinder along +Y, for trunks and branches, from `base` with a
   * direction and length. Normals point straight out from its axis.
   */
  limb(base: THREE.Vector3, dir: THREE.Vector3, length: number, r0: number, r1: number, sides: number, color: THREE.Color): void {
    const d = dir.clone().normalize();
    const side = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(d, side).normalize();
    const v = new THREE.Vector3().crossVectors(d, u).normalize();
    const start = this.pos.length / 3;
    const shade = color.clone().multiplyScalar(0.75);
    for (let ring = 0; ring < 2; ring++) {
      const r = ring ? r1 : r0;
      const c = base.clone().addScaledVector(d, ring * length);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const n = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
        this.vertex(c.x + n.x * r, c.y + n.y * r, c.z + n.z * r, n.x, n.y, n.z, ring ? color : shade);
      }
    }
    for (let k = 0; k < sides; k++) {
      const a = start + k;
      const b = start + ((k + 1) % sides);
      this.tri(a, b, a + sides);
      this.tri(b, b + sides, a + sides);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
