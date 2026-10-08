import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';
import { crownCloud } from './crown';
import { FoliageBuilder } from './foliageBuilder';
import { TILE } from './textures/atlasLayout';

const LEAVES = [TILE.leaves, TILE.leaves, TILE.leavesLight] as const;

/**
 * A broadleaf tree like a holm oak: a short trunk forking into a few
 * spreading limbs under a wide crown built from two or three overlapping
 * leafy masses, so the outline is lumpy and uneven instead of a ball.
 * `detail` drops limbs and most leaf cards for the distant version.
 */
function broadleaf(b: FoliageBuilder, rng: Rng, variant: number, detail: number): void {
  const top = variant ? 6.6 : 5.8;
  const forkAt = top * 0.42;
  b.limb(new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(rng.range(-0.1, 0.1), 1, rng.range(-0.1, 0.1)), forkAt + 0.4, 0.36, 0.24, detail > 0.5 ? 8 : 5, TILE.greyBark);
  const fork = new THREE.Vector3(0, forkAt, 0);
  const masses = variant ? 3 : 2;
  for (let k = 0; k < masses; k++) {
    const a = (k / masses) * Math.PI * 2 + rng.range(-0.5, 0.5);
    const out = rng.range(1.2, 2.0);
    const center = new THREE.Vector3(Math.cos(a) * out, top + rng.range(-0.6, 0.8), Math.sin(a) * out);
    const radii = new THREE.Vector3(rng.range(2.4, 3.1), rng.range(1.9, 2.4), rng.range(2.4, 3.1));
    if (detail > 0.5) {
      const dir = center.clone().sub(fork);
      b.limb(fork, dir, dir.length() * 0.85, 0.18, 0.06, 5, TILE.greyBark);
    }
    const cards = detail > 0.5 ? Math.round(64 / masses) + 8 : 6;
    crownCloud(b, rng, center, radii, cards, detail > 0.5 ? [1.5, 2.2] : [3, 3.8], LEAVES, 0.7);
  }
}

export function broadleafGeometry(variant: number): THREE.BufferGeometry {
  const b = new FoliageBuilder();
  broadleaf(b, new Rng(301 + variant * 13), variant, 1);
  return b.build();
}

/** A distant broadleaf: the same masses from a dozen big cards. */
export function broadleafLodGeometry(variant: number): THREE.BufferGeometry {
  const b = new FoliageBuilder();
  broadleaf(b, new Rng(301 + variant * 13), variant, 0);
  return b.build();
}

/**
 * A low shrub of dry scrub, about a meter tall at scale 1: a dome of small
 * leaf cards, the second shape twiggier and drier. No stems: at this size
 * the leaves hide them.
 */
export function shrubGeometry(variant: number): THREE.BufferGeometry {
  const b = new FoliageBuilder();
  const rng = new Rng(401 + variant * 3);
  const tiles = variant ? [TILE.brush, TILE.brush, TILE.scrub] : [TILE.scrub, TILE.scrub, TILE.brush];
  crownCloud(b, rng, new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(0.85, 0.55, 0.85), variant ? 9 : 11, [0.75, 1.15], tiles, 0.5);
  return b.build();
}
