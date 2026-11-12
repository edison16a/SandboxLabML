import * as THREE from 'three';
import type { CarShape } from './shape/types';

/** How far the patch reaches past the body's footprint, m, along and across. */
const MARGIN_ALONG = 0.6;
const MARGIN_ACROSS = 0.5;
/** Just above the road paint, so it darkens markings too. */
const LIFT = 0.016;

/**
 * One soft dark patch per traffic car, drawn as a single instanced quad:
 * the ambient darkening right under the floor and tires that makes a car
 * sit on the road. Low has no sun shadows at all, so it leans on this
 * most; the finer tiers keep it lighter beside their real shadows.
 */
export function createContactShadow(strong: boolean): { geometry: THREE.BufferGeometry; material: THREE.MeshBasicMaterial; dispose: () => void } {
  const w = 64;
  const h = 32;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Distance outside a rounded rectangle, faded over the outer part of the patch; u runs along the car.
      const u = Math.abs((x + 0.5) / w - 0.5) * 2;
      const v = Math.abs((y + 0.5) / h - 0.5) * 2;
      const d = Math.hypot(Math.max(0, u - 0.72), Math.max(0, v - 0.55)) / 0.42;
      const a = Math.max(0, 1 - d);
      data[(y * w + x) * 4 + 3] = Math.round(a * a * (3 - 2 * a) * 255);
    }
  }
  const map = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  // Black texels with the falloff in alpha. The units term keeps it in front of the road even looking straight down.
  // No fog: fog would pull the black toward the sky color and leave a pale patch under distant cars.
  const material = new THREE.MeshBasicMaterial({ map, color: 0x000000, transparent: true, opacity: strong ? 0.72 : 0.5, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  return { geometry, material, dispose: () => (map.dispose(), material.dispose(), geometry.dispose()) };
}

const local = new THREE.Matrix4();
const at = new THREE.Vector3(0, LIFT, 0);
const size = new THREE.Vector3();
const still = new THREE.Quaternion();

/** The patch's matrix for a car with body matrix `body`, sized to its type. Allocates nothing. */
export function contactShadowMatrix(body: THREE.Matrix4, s: CarShape, out: THREE.Matrix4): THREE.Matrix4 {
  local.compose(at, still, size.set(s.length + MARGIN_ALONG, 1, s.width + MARGIN_ACROSS));
  return out.multiplyMatrices(body, local);
}
