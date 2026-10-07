import * as THREE from 'three';
import { setTintMask } from '../shared/tintMask';

/** Brace width on the far away boxes, m: a touch wider than up close, so the pattern survives the distance. */
export const FAR_BRACE = 0.085;
/** Braces float this far off the panels, m. */
const LIFT = 0.006;
const WHITE = new THREE.Color(1, 1, 1);

/**
 * Builds the cheap boxes of the arena grid out of flat triangles: panels
 * in their own vertex color, and braces as flat white strips just above
 * them that take the instance color through the tint mask, so a locked
 * box can light them up.
 */
export class FlatMesh {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly tint: number[] = [];

  /** One triangle in `color`; `tinted` lets the instance color through. */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, tinted = false): void {
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.col.push(color.r, color.g, color.b);
      this.tint.push(tinted ? 1 : 0);
    }
  }

  /** A brace strip from a to b on a face with normal `n`, FAR_BRACE wide, lifted off the face. */
  strip(a: THREE.Vector3, b: THREE.Vector3, n: THREE.Vector3): void {
    const side = b.clone().sub(a).cross(n).normalize().multiplyScalar(FAR_BRACE / 2);
    const lift = n.clone().multiplyScalar(LIFT);
    const [p0, p1, p2, p3] = [a.clone().sub(side), b.clone().sub(side), b.clone().add(side), a.clone().add(side)].map((p) => p.add(lift));
    this.tri(p0, p2, p1, WHITE, true);
    this.tri(p0, p3, p2, WHITE, true);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    setTintMask(g, this.tint);
    g.computeVertexNormals();
    return g;
  }
}
