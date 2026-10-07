import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Mesh resolution: the two detail levels a character can be drawn at,
 * plus a coarse one for the instanced crowds of the arena grid.
 */
export type MeshDetail = 'full' | 'low' | 'instanced';

/** Segments for a detail level: full, low, and the instanced crowd (about half of low). */
export function segments(detail: MeshDetail, full: number, low: number, instanced = Math.max(3, Math.round(low * 0.6))): number {
  return detail === 'full' ? full : detail === 'low' ? low : instanced;
}

/**
 * Makes `g` one rigid part of the skinned character: every vertex follows
 * bone `bone` alone, in the color `color` (multiplied by the material's
 * own color). Only what the merged mesh needs is kept. Returns an indexed
 * geometry, so parts from primitives and from shapes merge together.
 */
export function rigid(g: THREE.BufferGeometry, bone: number, color: THREE.ColorRepresentation | number): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  const part = g.index ? g : mergeVertices(g);
  const n = part.attributes.position.count;
  const c = typeof color === 'number' ? new THREE.Color(color, color, color) : new THREE.Color(color);
  const colors = new Float32Array(n * 3);
  const index = new Uint16Array(n * 4);
  const weight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    colors.set([c.r, c.g, c.b], i * 3);
    index[i * 4] = bone;
    weight[i * 4] = 1;
  }
  part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  part.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  part.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
  return part;
}

/** Merges rigid parts into one mesh and frees them. */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** A capsule hanging from its bone's origin down to `length` along -y: an arm or leg segment whose round ends overlap at the joints. */
export function limb(length: number, radius: number, detail: MeshDetail): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(radius, length, segments(detail, 4, 2, 1), segments(detail, 12, 7, 5), 1);
  g.translate(0, -length / 2, 0);
  return g;
}

/** A sphere scaled into an ellipsoid with half extents (x, y, z), moved to (cx, cy, cz). */
export function ellipsoid(x: number, y: number, z: number, cx: number, cy: number, cz: number, detail: MeshDetail, full = 20): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, segments(detail, full, Math.round(full / 2)), segments(detail, Math.round(full * 0.7), Math.round(full / 3)));
  g.scale(x, y, z);
  g.translate(cx, cy, cz);
  return g;
}
