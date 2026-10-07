import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';
import { RUNOFF } from '@/engine/racing/car/runtime';
import type { Track } from '@/engine/racing/track/types';
import { padWeight } from '../../stadium/layout';
import { rockiness, terrainHeight, type TerrainShape } from '../terrain/terrainHeight';
import { distanceAt } from '../trackField';

/**
 * Clumps of dry grass along the verges, where the chase camera looks: a
 * few per meter of road close in, thinning out over 60 m. Walked along the
 * road rather than scattered over the map, so none are wasted on far hills.
 * They start past the wall and keep off every part of the road and the
 * buildings.
 */
export function placeTufts(track: Track, shape: TerrainShape, perMeter = 12): Float32Array {
  const rng = new Rng(shape.seed ^ 0x6a55);
  const out: number[] = [];
  const near = track.halfWidth + RUNOFF + 2.4;
  for (let i = 0; i < track.count; i++) {
    for (let k = 0; k < perMeter; k++) {
      // More of them close to the wall: the offset is skewed toward it.
      const t = rng.next();
      const lat = (rng.next() < 0.5 ? 1 : -1) * (near + t * t * 60);
      const along = rng.range(-0.5, 0.5);
      const x = track.cx[i] - track.ty[i] * lat + track.tx[i] * along;
      const z = -(track.cy[i] + track.tx[i] * lat + track.ty[i] * along);
      if (distanceAt(shape.field, x, z) < near - 0.3) continue;
      if (rockiness(shape, x, z) > 0.45 || shape.pads.some((p) => padWeight(p, x, z, 2) > 0)) continue;
      // Variant alternates 0 and 1, so a cheaper tier can draw every other tuft and keep an even spread.
      out.push(x, terrainHeight(shape, x, z), z, rng.range(0.45, 0.95), rng.range(0, Math.PI * 2), rng.next(), k % 2, 0);
    }
  }
  return Float32Array.from(out);
}

const BASE = new THREE.Color('#4f4528');
const TIP = new THREE.Color('#bfa66c');

/**
 * One tuft: four thin blades fanned out from a point, each built from both
 * sides so no back face goes black. Normals point straight up, so the grass
 * lights like the ground under it and blends in from a distance.
 */
export function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const rng = new Rng(77);
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const h = rng.range(0.35, 0.6);
    const lean = rng.range(0.12, 0.28);
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    const v = pos.length / 3;
    // Base corners across the blade's width, tip leaning out.
    pos.push(-cz * 0.07, 0, cx * 0.07, cz * 0.07, 0, -cx * 0.07, cx * lean, h, cz * lean);
    for (const c of [BASE, BASE, TIP]) col.push(c.r, c.g, c.b);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
