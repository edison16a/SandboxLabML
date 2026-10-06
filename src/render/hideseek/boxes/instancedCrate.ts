import * as THREE from 'three';
import type { BoxKind, BoxSize } from '@/engine/hideseek/physics';
import { BOX_LOOK } from './boxMaterials';
import { setTintMask } from '../shared/tintMask';
import { crateFaces, facePanels, panelCorner } from './bracedBox';

/** Brace width on the far away crates, m: a touch wider than up close, so the pattern survives the distance. */
const W = 0.085;
/** Braces float this far off the panels, m. */
const LIFT = 0.006;

/**
 * A cheap crate for the arena grid, one instanced draw call for every crate
 * of a kind: flat gold panels with the frame and X braces as flat strips
 * just above them, about 120 triangles. Panels keep their own color; the
 * braces take the instance color, so a locked crate can light them up.
 */
export function instancedCrateGeometry(kind: BoxKind, s: BoxSize): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const tint: number[] = [];
  const gold = new THREE.Color(BOX_LOOK[kind]);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, t: number) => {
    for (const p of [a, b, c]) {
      pos.push(p.x, p.y, p.z);
      col.push(color.r, color.g, color.b);
      tint.push(t);
    }
  };
  const white = new THREE.Color(1, 1, 1);
  /** A strip from a to b on a face, `W` wide, lifted off it along the face normal. */
  const strip = (a: THREE.Vector3, b: THREE.Vector3, n: THREE.Vector3) => {
    const side = b.clone().sub(a).cross(n).normalize().multiplyScalar(W / 2);
    const lift = n.clone().multiplyScalar(LIFT);
    const [p0, p1, p2, p3] = [a.clone().sub(side), b.clone().sub(side), b.clone().add(side), a.clone().add(side)].map((p) => p.add(lift));
    tri(p0, p2, p1, white, 1);
    tri(p0, p3, p2, white, 1);
  };
  for (const f of crateFaces(s)) {
    const { narrow, panels } = facePanels(f);
    for (const p of panels) {
      const [a, b, cc, d] = [panelCorner(f, p, -1, -1), panelCorner(f, p, 1, -1), panelCorner(f, p, 1, 1), panelCorner(f, p, -1, 1)];
      tri(a, b, cc, gold, 0);
      tri(a, cc, d, gold, 0);
      // The frame, inset by half a brace so neighboring faces meet at the edge.
      const inset = (q: THREE.Vector3, su: number, sv: number) => q.clone().addScaledVector(f.u, -su * W * 0.5).addScaledVector(f.v, -sv * W * 0.5);
      const [ia, ib, ic, id] = [inset(a, -1, -1), inset(b, 1, -1), inset(cc, 1, 1), inset(d, -1, 1)];
      strip(ia, ib, f.n);
      strip(ib, ic, f.n);
      strip(ic, id, f.n);
      strip(id, ia, f.n);
      if (!narrow) {
        strip(ia, ic, f.n);
        strip(ib, id, f.n);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  setTintMask(g, tint);
  g.computeVertexNormals();
  return g;
}
