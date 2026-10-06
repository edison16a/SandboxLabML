import * as THREE from 'three';
import type { Track } from '@/engine/racing/track/types';

/**
 * Builds road meshes straight from the engine's sampled track, so the edge a
 * ray hits is exactly the edge that is drawn. Offsets are measured from the
 * centerline, positive to the left.
 */
function sideOffset(track: Track, i: number, offset: number): [number, number] {
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

/**
 * Red and white kerbs on both edges wherever the road bends tighter than a
 * 45 m radius. Built as separate quads so stripe colors stay crisp.
 */
export function kerbGeometry(track: Track, width = 1.1): THREE.BufferGeometry | null {
  const hw = track.halfWidth;
  const pos: number[] = [];
  const col: number[] = [];
  const red = [0.78, 0.09, 0.1];
  const white = [0.95, 0.95, 0.95];
  for (let i = 0; i < track.count; i++) {
    const j = (i + 1) % track.count;
    const k = Math.max(Math.abs(track.curvature[i]), Math.abs(track.curvature[j]));
    if (k < 1 / 45) continue;
    const color = Math.floor((i * track.spacing) / 1.6) % 2 ? red : white;
    for (const side of [1, -1]) {
      const a0 = sideOffset(track, i, side * (hw - 0.15));
      const a1 = sideOffset(track, i, side * (hw + width));
      const b0 = sideOffset(track, j, side * (hw - 0.15));
      const b1 = sideOffset(track, j, side * (hw + width));
      const y0 = 0.035;
      const y1 = 0.11;
      const quad = [a0[0], y0, a0[1], b0[0], y0, b0[1], a1[0], y1, a1[1], a1[0], y1, a1[1], b0[0], y0, b0[1], b1[0], y1, b1[1]];
      pos.push(...quad);
      for (let v = 0; v < 6; v++) col.push(...color);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const normals = g.attributes.normal as THREE.BufferAttribute;
  for (let v = 0; v < normals.count; v++) if (normals.getY(v) < 0) normals.setXYZ(v, -normals.getX(v), -normals.getY(v), -normals.getZ(v));
  return g;
}

/** Dashed center line: 3 m dashes every 9 m. */
export function centerDashGeometry(track: Track): THREE.BufferGeometry {
  const pos: number[] = [];
  const per = Math.round(9 / track.spacing);
  const len = Math.round(3 / track.spacing);
  for (let i = 0; i + len < track.count; i += per) {
    for (let k = i; k < i + len; k++) {
      const a0 = sideOffset(track, k, -0.08);
      const a1 = sideOffset(track, k, 0.08);
      const b0 = sideOffset(track, k + 1, -0.08);
      const b1 = sideOffset(track, k + 1, 0.08);
      const y = 0.02;
      pos.push(a0[0], y, a0[1], b0[0], y, b0[1], a1[0], y, a1[1], a1[0], y, a1[1], b0[0], y, b0[1], b1[0], y, b1[1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** World poses for barrier blocks every `step` meters on both sides. */
export interface BarrierPose {
  x: number;
  z: number;
  yaw: number;
  curvature: number;
}

export function barrierPoses(track: Track, offset: number, step = 2): BarrierPose[] {
  const out: BarrierPose[] = [];
  const every = Math.max(1, Math.round(step / track.spacing));
  for (let i = 0; i < track.count; i += every) {
    const yaw = Math.atan2(track.ty[i], track.tx[i]);
    for (const side of [1, -1]) {
      const [x, z] = sideOffset(track, i, side * offset);
      out.push({ x, z, yaw, curvature: track.curvature[i] });
    }
  }
  return out;
}

/** Start line pose: center of the road at sample 0. */
export function startPose(track: Track): { x: number; z: number; yaw: number } {
  return { x: track.cx[0], z: -track.cy[0], yaw: Math.atan2(track.ty[0], track.tx[0]) };
}
