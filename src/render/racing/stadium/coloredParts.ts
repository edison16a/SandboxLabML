import * as THREE from 'three';

const WHITE = new THREE.Color(1, 1, 1);

/**
 * Collects simple shapes, each painted one flat color, into a single
 * geometry with a color attribute. A whole building then draws in one call
 * with one material, which keeps the stadium cheap on every tier.
 */
export class ColoredParts {
  private parts: THREE.BufferGeometry[] = [];

  /** Adds any geometry (it is consumed) painted in one color, or keeping its own colors when `color` is null. */
  add(geometry: THREE.BufferGeometry, color: THREE.Color | null): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    if (color || !g.attributes.color) {
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) (color ?? WHITE).toArray(col, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    this.parts.push(g);
    return this;
  }

  /** Adds an axis aligned box by size and center. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Color): this {
    return this.add(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);
  }

  build(): THREE.BufferGeometry {
    const total = this.parts.reduce((s, p) => s + p.attributes.position.count, 0);
    const pos = new Float32Array(total * 3);
    const nrm = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    let o = 0;
    for (const p of this.parts) {
      pos.set(p.attributes.position.array as Float32Array, o * 3);
      nrm.set(p.attributes.normal.array as Float32Array, o * 3);
      col.set(p.attributes.color.array as Float32Array, o * 3);
      o += p.attributes.position.count;
      p.dispose();
    }
    this.parts = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
