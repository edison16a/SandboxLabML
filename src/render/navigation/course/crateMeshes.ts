import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bracedBox, type BracedBoxParts } from '@/render/hideseek/boxes/bracedBox';
import { BOX_LOOK } from '@/render/hideseek/boxes/boxMaterials';

/** A crate of a size, standing at the origin, length along x. */
export interface CrateSize {
  length: number;
  width: number;
  height: number;
}

/**
 * Every crate placed and merged: one mesh of panels and one of braces, so a
 * field of crates costs two draw calls. Each size is built once for the
 * merge and freed with it; nothing is kept between courses, so a long run
 * through many courses holds only the course on screen.
 */
export function mergedCrates(crates: ReadonlyArray<CrateSize & { x: number; z: number }>): BracedBoxParts | null {
  if (crates.length === 0) return null;
  const sizes = new Map<string, BracedBoxParts>();
  const panels: THREE.BufferGeometry[] = [];
  const braces: THREE.BufferGeometry[] = [];
  for (const c of crates) {
    const key = `${c.length}:${c.width}:${c.height}`;
    let parts = sizes.get(key);
    if (!parts) sizes.set(key, (parts = bracedBox(c)));
    panels.push(parts.panels.clone().translate(c.x, 0, c.z));
    braces.push(parts.braces.clone().translate(c.x, 0, c.z));
  }
  const out = { panels: mergeGeometries(panels) as THREE.BufferGeometry, braces: mergeGeometries(braces) as THREE.BufferGeometry };
  [...panels, ...braces].forEach((g) => g.dispose());
  sizes.forEach((p) => {
    p.panels.dispose();
    p.braces.dispose();
  });
  return out;
}

/** One crate's meshes of a size, standing at the origin, with a dispose for when its owner unmounts. */
export function crateMesh(s: CrateSize): BracedBoxParts & { dispose: () => void } {
  const parts = bracedBox(s);
  return {
    ...parts,
    dispose: () => {
      parts.panels.dispose();
      parts.braces.dispose();
    },
  };
}

/** Lacquered panels in a crate color and the light frame, as in Hide and Seek. `full` adds the clear coat. */
export function crateMaterials(color: THREE.ColorRepresentation, full: boolean, glow = 0.06): { panel: THREE.MeshStandardMaterial; brace: THREE.MeshStandardMaterial; dispose: () => void } {
  const c = new THREE.Color(color);
  const panel = full
    ? new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, metalness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.22, envMapIntensity: 1.1 })
    : new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0.2, envMapIntensity: 1.1 });
  const brace = new THREE.MeshStandardMaterial({ color: BOX_LOOK.brace, roughness: 0.34, metalness: 0, emissive: BOX_LOOK.brace, emissiveIntensity: glow, envMapIntensity: 0.9 });
  return {
    panel,
    brace,
    dispose: () => {
      panel.dispose();
      brace.dispose();
    },
  };
}
