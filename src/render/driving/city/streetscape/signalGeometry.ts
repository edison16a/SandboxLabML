import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Lamp centers on a signal head, local y, top to bottom: red, yellow, green. Lamps face local +x. */
export const LAMP_Y = [0.33, 0, -0.33] as const;
export const LAMP_X = 0.146;
export const LAMP_R = 0.105;

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ready = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  for (const g of ready) for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  const out = mergeGeometries(ready) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  ready.forEach((p) => p.dispose());
  out.computeBoundingSphere();
  return out;
}

/**
 * A three lamp signal head: the housing, a visor over each lamp and a
 * backplate, all one dark part. The lamps themselves are separate
 * instanced discs so each can light on its own.
 */
export function signalHeadGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.28, 1.04, 0.36), new THREE.BoxGeometry(0.03, 1.28, 0.6).translate(-0.16, 0, 0)];
  for (const y of LAMP_Y) {
    // A visor over each lamp, with short cheeks down its sides, so the lamp sits in a shaded hood.
    parts.push(new THREE.BoxGeometry(0.2, 0.018, LAMP_R * 2 + 0.06).translate(LAMP_X + 0.1, y + LAMP_R + 0.025, 0));
    for (const z of [-1, 1]) parts.push(new THREE.BoxGeometry(0.2, LAMP_R, 0.014).translate(LAMP_X + 0.1, y + LAMP_R * 0.55, z * (LAMP_R + 0.03)));
  }
  return merged(parts);
}

/** A walk signal's housing: a small box on its pole, the lit face separate. Faces local +x. */
export function walkHeadGeometry(): THREE.BufferGeometry {
  return merged([new THREE.BoxGeometry(0.2, 0.42, 0.34), new THREE.BoxGeometry(0.14, 0.04, 0.34).translate(0.06, 0.23, 0)]);
}

/** A lamp disc facing +x. */
export function lampGeometry(): THREE.BufferGeometry {
  return new THREE.CircleGeometry(LAMP_R, 18).rotateY(Math.PI / 2);
}

/** The walk signal's lit face, facing +x. */
export function walkFaceGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(0.26, 0.3).rotateY(Math.PI / 2);
}

/** A pole from the ground up, 1 m tall at scale 1 (instances stretch it). */
export function poleGeometry(radius: number, segments = 10): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius * 0.85, radius, 1, segments, 1, true).translate(0, 0.5, 0);
}

/** A mast arm along local +x, 1 m long at scale 1. */
export function armGeometry(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.05, 0.065, 1, 8, 1, true).rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
}
