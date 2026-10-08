import * as THREE from 'three';
import { STRIDE } from './placement';

/** Matrices and tints for a set of placed items, ready to copy into instanced meshes. */
export interface InstanceSet {
  count: number;
  /** World position of each item, for distance checks: x, y, z. */
  at: Float32Array;
  matrices: Float32Array;
  colors: Float32Array;
}

interface Look {
  /** How far the item sinks into the ground, so roots and rock bases never float on a slope. */
  sink: number;
  /** Extra height variety: height scale ranges over 1 plus or minus this. */
  stretch: number;
  /** Tint at the item's tint value 0 and 1, multiplied over the vertex colors. */
  from: THREE.Color;
  to: THREE.Color;
}

/** Builds instance data for the items of one variant (`variant` < 0 takes them all). */
export function instanceSet(items: Float32Array, variant: number, look: Look): InstanceSet {
  const picked: number[] = [];
  for (let k = 0; k < items.length; k += STRIDE) if (variant < 0 || items[k + 6] === variant) picked.push(k);
  const n = picked.length;
  const at = new Float32Array(n * 3);
  const matrices = new Float32Array(n * 16);
  const colors = new Float32Array(n * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  picked.forEach((k, i) => {
    const scale = items[k + 3];
    const tint = items[k + 5];
    p.set(items[k], items[k + 1] - look.sink * scale, items[k + 2]);
    q.setFromAxisAngle(up, items[k + 4]);
    s.set(scale, scale * (1 - look.stretch + tint * look.stretch * 2), scale);
    m.compose(p, q, s).toArray(matrices, i * 16);
    at.set([items[k], items[k + 1], items[k + 2]], i * 3);
    c.copy(look.from).lerp(look.to, tint).toArray(colors, i * 3);
  });
  return { count: n, at, matrices, colors };
}

/**
 * Copies the chosen items into an instanced mesh's buffers. Plain loops, no
 * subarray views, so a per frame call allocates nothing.
 */
export function writeInstance(mesh: THREE.InstancedMesh, slot: number, set: InstanceSet, i: number): void {
  const dst = mesh.instanceMatrix.array as Float32Array;
  const src = set.matrices;
  const o = slot * 16;
  const from = i * 16;
  for (let k = 0; k < 16; k++) dst[o + k] = src[from + k];
  const color = mesh.instanceColor;
  if (color) {
    const cd = color.array as Float32Array;
    cd[slot * 3] = set.colors[i * 3];
    cd[slot * 3 + 1] = set.colors[i * 3 + 1];
    cd[slot * 3 + 2] = set.colors[i * 3 + 2];
  }
}

/** Gives a fresh instanced mesh its color buffer up front, so writeInstance can fill it. */
export function withColors(mesh: THREE.InstancedMesh, capacity: number): THREE.InstancedMesh {
  if (!mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
  return mesh;
}
