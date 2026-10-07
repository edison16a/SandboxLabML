import * as THREE from 'three';
import type { Track } from '@/engine/racing/track/types';

/**
 * Builds road meshes straight from the engine's sampled track, so the edge a
 * ray hits is exactly the edge that is drawn. Offsets are measured from the
 * centerline, positive to the left.
 */
export function sideOffset(track: Track, i: number, offset: number): [number, number] {
  // Left normal is the tangent rotated +90 degrees in sim space.
  const x = track.cx[i] - track.ty[i] * offset;
  const y = track.cy[i] + track.tx[i] * offset;
  return [x, -y];
}

/** A closed strip between two offsets. UV u runs across, v along the road (one unit per `vScale` meters). */
export function ribbon(track: Track, inner: number, outer: number, height: number, vScale = 10): THREE.BufferGeometry {
  const n = track.count;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  for (let k = 0; k <= n; k++) {
    const i = k % n;
    const [ax, az] = sideOffset(track, i, inner);
    const [bx, bz] = sideOffset(track, i, outer);
    pos.set([ax, height, az, bx, height, bz], k * 6);
    const v = (k * track.spacing) / vScale;
    uv.set([0, v, 1, v], k * 4);
  }
  const index: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = k * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  fixWinding(g);
  return g;
}

/** Makes sure normals point up regardless of which way the track loops. */
function fixWinding(g: THREE.BufferGeometry): void {
  const normals = g.attributes.normal as THREE.BufferAttribute;
  if (normals.count && normals.getY(0) < 0) {
    const idx = g.index as THREE.BufferAttribute;
    for (let i = 0; i < idx.count; i += 3) {
      const t = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, t);
    }
    g.computeVertexNormals();
  }
}

/** Start line pose: center of the road at sample 0. */
export function startPose(track: Track): { x: number; z: number; yaw: number } {
  return { x: track.cx[0], z: -track.cy[0], yaw: Math.atan2(track.ty[0], track.tx[0]) };
}
