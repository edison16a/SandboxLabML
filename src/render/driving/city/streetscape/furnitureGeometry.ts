import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Paints a part one vertex color and drops attributes the merge does not need. */
function paint(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo !== g) g.dispose();
  return geo;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

const STEEL = '#33363b';

/**
 * A street lamp, facing +x toward the road: a tapered pole, a slim arm
 * reaching out over the gutter and a flat modern head. The glass under
 * the head is its own part (see lampGlassGeometry) so it can glow.
 */
export function lampPostGeometry(): THREE.BufferGeometry {
  return merged([
    paint(new THREE.CylinderGeometry(0.06, 0.1, 7.4, 10).translate(0, 3.7, 0), STEEL),
    paint(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 10).translate(0, 0.25, 0), STEEL),
    paint(new THREE.BoxGeometry(1.7, 0.07, 0.07).translate(0.8, 7.3, 0), STEEL),
    paint(new THREE.BoxGeometry(0.72, 0.1, 0.3).translate(1.72, 7.28, 0), '#24262a'),
  ]);
}

export function lampGlassGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(0.6, 0.22).rotateX(Math.PI / 2).translate(1.72, 7.225, 0);
}

/** A square concrete planter with dark soil, for a street tree. */
export function planterGeometry(): THREE.BufferGeometry {
  return merged([
    paint(new THREE.BoxGeometry(1.4, 0.42, 1.4).translate(0, 0.21, 0), '#a7a49c'),
    paint(new THREE.BoxGeometry(1.18, 0.05, 1.18).translate(0, 0.4, 0), '#3a2e22'),
  ]);
}

/** A slatted bench on two steel frames, facing +x (the street). */
export function benchGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) parts.push(paint(new THREE.BoxGeometry(0.1, 0.035, 1.8).translate(0.12 - k * 0.11, 0.46, 0), '#7a5634'));
  for (let k = 0; k < 3; k++) parts.push(paint(new THREE.BoxGeometry(0.035, 0.09, 1.8).translate(-0.27, 0.6 + k * 0.12, 0), '#7a5634'));
  for (const z of [-0.75, 0.75]) {
    parts.push(paint(new THREE.BoxGeometry(0.5, 0.05, 0.06).translate(-0.05, 0.43, z), STEEL));
    parts.push(paint(new THREE.BoxGeometry(0.05, 0.45, 0.06).translate(0.15, 0.22, z), STEEL));
    parts.push(paint(new THREE.BoxGeometry(0.05, 0.85, 0.06).translate(-0.28, 0.42, z), STEEL));
  }
  return merged(parts);
}

/** A round steel litter bin with a domed lid. */
export function binGeometry(): THREE.BufferGeometry {
  return merged([
    paint(new THREE.CylinderGeometry(0.26, 0.24, 0.85, 14).translate(0, 0.425, 0), '#2c3b33'),
    paint(new THREE.SphereGeometry(0.27, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1).translate(0, 0.85, 0), '#23302a'),
  ]);
}
