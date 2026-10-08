import * as THREE from 'three';
import type { Track } from '@/engine/racing/track/types';
import { ribbon } from '../trackGeometry';
import type { RacingLine } from './racingLine';

/**
 * The road surface with what the asphalt shader needs per vertex: where
 * the racing line runs across the road (0 at the right edge, 1 at the left)
 * and how much rubber it carries.
 */
export function roadGeometry(track: Track, line: RacingLine): THREE.BufferGeometry {
  const hw = track.halfWidth;
  const g = ribbon(track, -hw, hw, 0.012, 8);
  const n = track.count;
  const attr = new Float32Array((n + 1) * 2 * 2);
  for (let k = 0; k <= n; k++) {
    const i = k % n;
    const u = (line.lateral[i] + hw) / (2 * hw);
    attr.set([u, line.rubber[i], u, line.rubber[i]], k * 4);
  }
  g.setAttribute('line', new THREE.BufferAttribute(attr, 2));
  return g;
}

/** How much a stretch of road bends within `reach` samples either way, as a 0 to 1 corner weight. */
export function cornerWeight(track: Track, i: number, reach = 25): number {
  let bend = 0;
  for (let j = -reach; j <= reach; j += 5) bend = Math.max(bend, Math.abs(track.curvature[(i + j + track.count) % track.count]));
  return Math.min(1, Math.max(0, (bend - 1 / 90) * 60));
}

/**
 * A run-off strip with a per vertex `corner` weight: gravel traps where the
 * road bends, mown grass along the straights, the way a real circuit is
 * built.
 */
export function runoffGeometry(track: Track, inner: number, outer: number): THREE.BufferGeometry {
  const g = ribbon(track, inner, outer, 0.006, 6);
  const n = track.count;
  const corner = new Float32Array((n + 1) * 2);
  for (let k = 0; k <= n; k++) {
    const w = cornerWeight(track, k % n);
    corner[k * 2] = w;
    corner[k * 2 + 1] = w;
  }
  g.setAttribute('corner', new THREE.BufferAttribute(corner, 1));
  return g;
}
