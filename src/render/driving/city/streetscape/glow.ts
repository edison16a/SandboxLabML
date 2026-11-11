import * as THREE from 'three';

/**
 * A soft round glow for lit lamps: bright in the middle, falling off to
 * nothing at the edge, white so the point's color tints it. Drawn
 * additively behind signals, lamps and brake lights.
 */
export function glowTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2);
      // A tight core plus a wide soft halo.
      const a = Math.max(0, 1 - r) ** 3 * 0.75 + Math.max(0, 1 - r * 2.5) ** 2 * 0.6;
      const k = (y * size + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
