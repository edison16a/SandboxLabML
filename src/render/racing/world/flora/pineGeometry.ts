import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';
import { FoliageBuilder } from './foliageBuilder';
import { crownCloud } from './crown';
import { TILE } from './textures/atlasLayout';

/** A pine is about this tall at scale 1, m. */
export const PINE_HEIGHT = 15;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Whorls of branches up a straight trunk, each branch carrying needle
 * tufts along its outer half: a tall pine whose crown narrows to a point,
 * with gaps between the layers where the trunk and the sky show through.
 * `detail` thins the tufts for the distant version.
 */
function conical(b: FoliageBuilder, rng: Rng, detail: number): void {
  const h = PINE_HEIGHT;
  b.limb(new THREE.Vector3(0, -0.4, 0), UP, h * 0.97, 0.34, 0.05, detail > 0.5 ? 9 : 5);
  const layers = detail > 0.5 ? 9 : 5;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = h * (0.3 + 0.64 * t);
    const count = Math.max(3, Math.round((6 - t * 3) * (detail > 0.5 ? 1 : 0.7)));
    const spin = rng.range(0, Math.PI * 2);
    const reach = (3.5 * (1 - t) ** 0.9 + 0.7) * rng.range(0.85, 1.15);
    for (let k = 0; k < count; k++) {
      const a = spin + (k / count) * Math.PI * 2 + rng.range(-0.35, 0.35);
      const len = reach * rng.range(0.8, 1.1);
      const dir = new THREE.Vector3(Math.cos(a), rng.range(-0.25, 0.2), Math.sin(a)).normalize();
      if (detail > 0.5) b.limb(new THREE.Vector3(0, y, 0), dir, len, 0.05 + 0.06 * (1 - t), 0.02, 4);
      const tufts = detail > 0.5 ? (len > 2.2 ? 3 : 2) : 1;
      for (let j = 0; j < tufts; j++) {
        const f = tufts === 1 ? 0.7 : 0.4 + (0.55 * j) / (tufts - 1);
        // Tips droop a little under their own weight.
        p.set(0, y, 0).addScaledVector(dir, len * f).add(new THREE.Vector3(rng.range(-0.2, 0.2), -f * f * 0.5 + rng.range(-0.15, 0.25), rng.range(-0.2, 0.2)));
        n.set(p.x, 0.9 + (1 - t) * 0.2, p.z);
        const size = (1.25 + len * 0.42) * rng.range(0.85, 1.15) * (detail > 0.5 ? 1 : 1.5);
        b.card(p, size, rng.next() < 0.3 ? TILE.needleTips : TILE.needles, rng.range(0, Math.PI * 2), n, 0.55 + 0.45 * f);
      }
    }
  }
  // The leader: a few small tufts at the very top.
  for (let k = 0; k < (detail > 0.5 ? 3 : 1); k++) {
    p.set(rng.range(-0.25, 0.25), h * (0.95 + k * 0.025), rng.range(-0.25, 0.25));
    b.card(p, 1.2 - k * 0.2, TILE.needleTips, rng.range(0, Math.PI * 2), n.set(p.x, 1, p.z), 1);
  }
}

/**
 * A stone pine of dry southern hills: a long bare trunk with a slight lean
 * that forks into a few limbs under a broad, flat topped canopy.
 */
function umbrella(b: FoliageBuilder, rng: Rng, detail: number): void {
  const h = PINE_HEIGHT;
  const lean = new THREE.Vector3(rng.range(-0.08, 0.08), 1, rng.range(-0.08, 0.08));
  const fork = new THREE.Vector3(0, -0.4, 0).addScaledVector(lean.clone().normalize(), h * 0.6);
  b.limb(new THREE.Vector3(0, -0.4, 0), lean, h * 0.62, 0.4, 0.22, detail > 0.5 ? 9 : 5);
  const center = new THREE.Vector3(fork.x, h * 0.84, fork.z);
  const radii = new THREE.Vector3(4.4, 1.5, 4.4);
  const limbs = detail > 0.5 ? 4 : 0;
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const tip = center.clone().add(new THREE.Vector3(Math.cos(a) * 2.6, -0.4, Math.sin(a) * 2.6));
    const dir = tip.clone().sub(fork);
    b.limb(fork, dir, dir.length(), 0.2, 0.06, 5);
  }
  crownCloud(b, rng, center, radii, detail > 0.5 ? 64 : 12, detail > 0.5 ? [1.9, 2.7] : [3.4, 4.2], [TILE.needles, TILE.needleTips], 0.35);
}

/** A detailed pine. Variant 0 is a tall conical pine, variant 1 a stone pine with a flat crown. */
export function pineGeometry(variant: number): THREE.BufferGeometry {
  const b = new FoliageBuilder();
  const rng = new Rng(101 + variant * 7);
  if (variant === 0) conical(b, rng, 1);
  else umbrella(b, rng, 1);
  return b.build();
}

/** A distant pine: the same silhouette from a fraction of the tufts, each bigger. */
export function pineLodGeometry(variant: number): THREE.BufferGeometry {
  const b = new FoliageBuilder();
  const rng = new Rng(201 + variant * 7);
  if (variant === 0) conical(b, rng, 0);
  else umbrella(b, rng, 0);
  return b.build();
}
