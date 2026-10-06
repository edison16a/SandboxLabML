import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Wheel size in meters, shared with the car body so the arches fit. */
export const WHEEL = { radius: 0.34, width: 0.27, rim: 0.225 };

/** Turns a lathe (spun around Y) so the wheel's axle runs along Z, the car's side to side axis. */
function axleAlongZ(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.rotateX(Math.PI / 2);
  return g;
}

/**
 * The tire: a lathe of a rounded section, so the sidewall catches light like
 * rubber instead of reading as a flat cylinder cap. The inner hole is left
 * open; the rim fills it.
 */
export function tireGeometry(): THREE.BufferGeometry {
  const { radius: r, width: w, rim } = WHEEL;
  const half = w / 2;
  const c = 0.05;
  const pts: THREE.Vector2[] = [new THREE.Vector2(rim, -half + 0.02), new THREE.Vector2(r - c, -half)];
  // Rounded shoulders: a quarter circle at each edge of the tread.
  for (let i = 1; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, -half + c + Math.sin(a) * c));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, half - c + Math.sin(a) * c));
  }
  pts.push(new THREE.Vector2(rim, half - 0.02));
  return axleAlongZ(new THREE.LatheGeometry(pts, 28));
}

/**
 * A five spoke alloy: a shallow dish, a lip, spokes and a hub. Spokes make
 * the wheel's spin visible, which a plain disc would hide.
 */
export function rimGeometry(): THREE.BufferGeometry {
  const { width: w, rim } = WHEEL;
  const half = w / 2 - 0.02;
  const lip = new THREE.LatheGeometry(
    [new THREE.Vector2(rim - 0.025, -half), new THREE.Vector2(rim, -half + 0.01), new THREE.Vector2(rim, half - 0.01), new THREE.Vector2(rim - 0.025, half)],
    28,
  );
  const dish = new THREE.CylinderGeometry(rim - 0.03, rim - 0.03, 0.03, 28, 1, true);
  dish.translate(0, half - 0.05, 0);
  const hub = new THREE.CylinderGeometry(0.055, 0.065, 0.06, 12);
  hub.translate(0, half - 0.02, 0);
  const parts: THREE.BufferGeometry[] = [lip, dish, hub];
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.BoxGeometry(0.045, 0.035, rim - 0.06);
    spoke.translate(0, half - 0.035, (rim - 0.06) / 2 + 0.03);
    spoke.rotateY((i / 5) * Math.PI * 2);
    parts.push(spoke);
  }
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))) as THREE.BufferGeometry;
  return axleAlongZ(merged);
}
