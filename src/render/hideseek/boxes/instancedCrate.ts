import * as THREE from 'three';
import type { BoxKind, BoxSize } from '@/engine/hideseek/physics';
import { BOX_LOOK } from './boxMaterials';
import { crateFaces, facePanels, panelCorner } from './bracedBox';
import { FAR_BRACE, FlatMesh } from './flatMesh';

/**
 * A cheap crate for the arena grid, one instanced draw call for every crate
 * of a kind: flat gold panels with the frame and X braces as flat strips
 * just above them, about 120 triangles. Panels keep their own color; the
 * braces take the instance color, so a locked crate can light them up.
 */
export function instancedCrateGeometry(kind: BoxKind, s: BoxSize): THREE.BufferGeometry {
  const mesh = new FlatMesh();
  const gold = new THREE.Color(BOX_LOOK[kind]);
  for (const f of crateFaces(s)) {
    const { narrow, panels } = facePanels(f);
    for (const p of panels) {
      const [a, b, cc, d] = [panelCorner(f, p, -1, -1), panelCorner(f, p, 1, -1), panelCorner(f, p, 1, 1), panelCorner(f, p, -1, 1)];
      mesh.tri(a, b, cc, gold);
      mesh.tri(a, cc, d, gold);
      // The frame, inset by half a brace so neighboring faces meet at the edge.
      const inset = (q: THREE.Vector3, su: number, sv: number) => q.clone().addScaledVector(f.u, -su * FAR_BRACE * 0.5).addScaledVector(f.v, -sv * FAR_BRACE * 0.5);
      const [ia, ib, ic, id] = [inset(a, -1, -1), inset(b, 1, -1), inset(cc, 1, 1), inset(d, -1, 1)];
      mesh.strip(ia, ib, f.n);
      mesh.strip(ib, ic, f.n);
      mesh.strip(ic, id, f.n);
      mesh.strip(id, ia, f.n);
      if (!narrow) {
        mesh.strip(ia, ic, f.n);
        mesh.strip(ib, id, f.n);
      }
    }
  }
  return mesh.build();
}
