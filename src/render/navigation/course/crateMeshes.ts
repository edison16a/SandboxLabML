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

const built = new Map<string, BracedBoxParts>();

/** The braced crate meshes for a size, built once and shared by every crate that size. */
export function crateParts(s: CrateSize): BracedBoxParts {
  const key = `${s.length}:${s.width}:${s.height}`;
  let parts = built.get(key);
  if (!parts) {
    parts = bracedBox(s);
    built.set(key, parts);
  }
  return parts;
}

/** Every crate placed and merged: one mesh of panels and one of braces, so a field of crates costs two draw calls. */
export function mergedCrates(crates: ReadonlyArray<CrateSize & { x: number; z: number }>): BracedBoxParts | null {
  if (crates.length === 0) return null;
  const panels: THREE.BufferGeometry[] = [];
  const braces: THREE.BufferGeometry[] = [];
  for (const c of crates) {
    const parts = crateParts(c);
    panels.push(parts.panels.clone().translate(c.x, 0, c.z));
    braces.push(parts.braces.clone().translate(c.x, 0, c.z));
  }
  const out = { panels: mergeGeometries(panels) as THREE.BufferGeometry, braces: mergeGeometries(braces) as THREE.BufferGeometry };
  [...panels, ...braces].forEach((g) => g.dispose());
  return out;
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
