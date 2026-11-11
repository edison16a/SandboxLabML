import * as THREE from 'three';
import { TILE, tileRect } from './textures/atlasLayout';

/**
 * Collects a plant as one geometry for the foliage material: solid parts
 * (trunks and limbs, textured with an opaque bark tile) and camera facing
 * cards of needles or leaves. Every vertex carries a `corner`: zero for
 * solid parts, and for a card the offset of that corner from the card's
 * pivot, in meters, which the vertex shader lays out along the camera's
 * right and up axes. A shade value per vertex darkens the inside of a
 * crown, a cheap stand in for the light a real canopy blocks.
 */
export class FoliageBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private uv: number[] = [];
  private corner: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  private vertex(x: number, y: number, z: number, n: THREE.Vector3, u: number, v: number, cx: number, cy: number, shade: number): number {
    this.pos.push(x, y, z);
    this.nrm.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.corner.push(cx, cy);
    this.col.push(shade, shade, shade);
    return this.pos.length / 3 - 1;
  }

  /**
   * A card `size` meters across, centered on `pivot`, showing atlas `tile`,
   * turned `spin` radians in the view plane. `normal` is the shading normal
   * for the whole card: pointing out of the crown, so the crown lights as
   * one soft volume, lit on the sun side and dark beneath.
   */
  card(pivot: THREE.Vector3, size: number, tile: number, spin: number, normal: THREE.Vector3, shade: number): void {
    const [u0, v0, u1, v1] = tileRect(tile);
    const c = Math.cos(spin) * size * 0.5;
    const s = Math.sin(spin) * size * 0.5;
    const n = normal.clone().normalize();
    const corners: Array<[number, number, number, number]> = [
      [-1, -1, u0, v0],
      [1, -1, u1, v0],
      [1, 1, u1, v1],
      [-1, 1, u0, v1],
    ];
    const at = corners.map(([x, y, u, v]) => this.vertex(pivot.x, pivot.y, pivot.z, n, u, v, x * c - y * s, x * s + y * c, shade));
    this.idx.push(at[0], at[1], at[2], at[0], at[2], at[3]);
  }

  /**
   * A tapered limb from `base` along `dir`, for trunks and branches, wrapped
   * in a bark tile: u runs round the limb, v along it.
   */
  limb(base: THREE.Vector3, dir: THREE.Vector3, length: number, r0: number, r1: number, sides: number, tile: number = TILE.pineBark): void {
    const [u0, v0, u1, v1] = tileRect(tile);
    const d = dir.clone().normalize();
    const side = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3().crossVectors(d, side).normalize();
    const b = new THREE.Vector3().crossVectors(d, a).normalize();
    const start = this.pos.length / 3;
    const n = new THREE.Vector3();
    for (let ring = 0; ring < 2; ring++) {
      const r = ring ? r1 : r0;
      const center = base.clone().addScaledVector(d, ring * length);
      for (let k = 0; k <= sides; k++) {
        const t = (k / sides) * Math.PI * 2;
        n.copy(a).multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t));
        // Bark tiles along the limb about once per 3 m; the tile cannot wrap, so long limbs squeeze it a little.
        const v = v0 + (v1 - v0) * Math.min(1, ring * Math.max(0.35, length / 6));
        this.vertex(center.x + n.x * r, center.y + n.y * r, center.z + n.z * r, n, u0 + ((u1 - u0) * k) / sides, v, 0, 0, ring ? 1 : 0.7);
      }
    }
    for (let k = 0; k < sides; k++) {
      const p = start + k;
      const q = start + k + 1;
      this.idx.push(p, q, p + sides + 1, q, q + sides + 1, p + sides + 1);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('corner', new THREE.Float32BufferAttribute(this.corner, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    // Cards reach out from their pivots in the shader, so the bounds need their reach too.
    if (g.boundingSphere) g.boundingSphere.radius += 2;
    return g;
  }
}
