import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';
import { valueNoise } from '../noise';
import { MeshBuilder } from './meshBuilder';

const BARK = new THREE.Color('#5e4a38');
const LEAF_DEEP = new THREE.Color('#2c3d1c');
const LEAF = new THREE.Color('#4d6a2b');
const LEAF_LIT = new THREE.Color('#7a9140');

/**
 * One clump of leaves: a lumpy ball. Normals blend the clump's own roundness
 * with the direction out from the whole crown, so the tree lights as one
 * soft volume with bumps, the way a real canopy reads from a distance.
 */
export function clump(b: MeshBuilder, base: THREE.IcosahedronGeometry, center: THREE.Vector3, radius: number, crown: THREE.Vector3, seed: number): void {
  const pos = base.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Color();
  const idx: number[] = [];
  const map = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Shared corners must stay shared, or the lumps tear apart.
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    const known = map.get(key);
    if (known !== undefined) {
      idx.push(known);
      continue;
    }
    const lump = 0.82 + valueNoise(x * 2.2 + seed, z * 2.2 + y * 1.7, seed) * 0.36;
    const px = center.x + x * radius * lump;
    const py = center.y + y * radius * lump * 0.86;
    const pz = center.z + z * radius * lump;
    const out = new THREE.Vector3(px - crown.x, (py - crown.y) * 0.8, pz - crown.z).normalize();
    const nx = x * 0.45 + out.x;
    const ny = y * 0.45 + out.y + 0.15;
    const nz = z * 0.45 + out.z;
    const light = THREE.MathUtils.clamp(0.5 + ny * 0.5, 0, 1);
    c.copy(LEAF_DEEP).lerp(LEAF, Math.min(1, light * 1.4)).lerp(LEAF_LIT, Math.max(0, light - 0.6) * 1.5);
    const v = b.vertex(px, py, pz, nx, ny, nz, c);
    map.set(key, v);
    idx.push(v);
  }
  for (let i = 0; i < idx.length; i += 3) b.tri(idx[i], idx[i + 1], idx[i + 2]);
}

/** A broadleaf tree: a short trunk that forks into a wide crown of leafy clumps. */
export function broadleafGeometry(variant: number): THREE.BufferGeometry {
  const rng = new Rng(301 + variant * 13);
  const b = new MeshBuilder();
  const base = new THREE.IcosahedronGeometry(1, 1);
  const crown = new THREE.Vector3(0, variant ? 6.4 : 5.6, 0);
  b.limb(new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, 1, 0), crown.y - 1.2, 0.34, 0.2, 7, BARK);
  for (let k = 0; k < 3; k++) {
    const a = rng.range(0, Math.PI * 2);
    b.limb(new THREE.Vector3(0, crown.y - 2.4, 0), new THREE.Vector3(Math.cos(a) * 0.8, 1, Math.sin(a) * 0.8), 2.6, 0.16, 0.06, 5, BARK);
  }
  const clumps = variant ? 7 : 6;
  for (let k = 0; k < clumps; k++) {
    const a = (k / clumps) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const out = k === 0 ? 0 : rng.range(1.6, 2.5);
    const center = new THREE.Vector3(Math.cos(a) * out, crown.y + rng.range(-0.6, 1.4) + (k === 0 ? 1.4 : 0), Math.sin(a) * out);
    clump(b, base, center, rng.range(1.9, 2.6), crown, k + variant * 10);
  }
  base.dispose();
  return b.build();
}

/** A distant broadleaf: one lumpy ball on a stub. */
export function broadleafLodGeometry(variant: number): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const base = new THREE.IcosahedronGeometry(1, 0);
  const crown = new THREE.Vector3(0, variant ? 6.6 : 5.9, 0);
  b.limb(new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, 1, 0), crown.y - 2, 0.34, 0.24, 4, BARK);
  clump(b, base, crown, 3.9, crown.clone().setY(crown.y - 1), 50 + variant);
  base.dispose();
  return b.build();
}
