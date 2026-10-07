import * as THREE from 'three';
import { Rng } from '@/engine/core/rng';
import { MeshBuilder } from './meshBuilder';

/** A pine is about this tall at scale 1, m. */
export const PINE_HEIGHT = 15;

const BARK = new THREE.Color('#5b4434');
const NEEDLE_DEEP = new THREE.Color('#1d2c17');
const NEEDLE = new THREE.Color('#2f4524');
const NEEDLE_TIP = new THREE.Color('#4f6b33');

/**
 * One whorl of branches: a drooping, ragged skirt round the trunk. The rim
 * is jittered in and out and up and down so the silhouette breaks into
 * clumps, and its normals point out from the trunk and a little up, so the
 * whorl shades like a soft mass of needles, light on top and dark beneath.
 */
function whorl(b: MeshBuilder, rng: Rng, y: number, radius: number, height: number, points: number, lean: number): void {
  const spin = rng.range(0, Math.PI * 2);
  const apex = b.vertex(0, y + height, 0, 0, 1, 0, NEEDLE);
  const mid: number[] = [];
  const rim: number[] = [];
  for (let k = 0; k < points; k++) {
    const a = spin + (k / points) * Math.PI * 2 + rng.range(-0.18, 0.18);
    const r = radius * rng.range(0.72, 1.18);
    const droop = rng.range(0.15, 0.55) * height;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    // Halfway out the branches bulge up, then droop to their tips.
    mid.push(b.vertex(cx * r * 0.55, y + height * 0.62, cz * r * 0.55, cx, 0.9, cz, NEEDLE));
    rim.push(b.vertex(cx * r, y - droop + lean * cx, cz * r, cx, 0.35, cz, NEEDLE_TIP));
  }
  const under = b.vertex(0, y + height * 0.12, 0, 0, -1, 0, NEEDLE_DEEP);
  for (let k = 0; k < points; k++) {
    const n = (k + 1) % points;
    b.tri(apex, mid[n], mid[k]);
    b.tri(mid[k], mid[n], rim[k]);
    b.tri(mid[n], rim[n], rim[k]);
    b.tri(under, rim[k], rim[n]);
  }
}

/**
 * A detailed pine. Variant 0 is a full, conical pine with branches most of
 * the way down; variant 1 is a tall umbrella pine with a long bare trunk
 * and a few big clumps up top, like the pines on dry southern hills.
 */
export function pineGeometry(variant: number): THREE.BufferGeometry {
  const rng = new Rng(101 + variant * 7);
  const b = new MeshBuilder();
  const tall = variant === 1;
  b.limb(new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, 1, 0), PINE_HEIGHT * 0.93, tall ? 0.36 : 0.32, 0.07, 7, BARK);
  const layers = tall ? 6 : 9;
  const start = tall ? 0.46 : 0.18;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = PINE_HEIGHT * (start + (0.9 - start) * t);
    const radius = tall ? 3.1 - t * 1.9 : 3.6 * (1 - t) ** 0.85 + 0.55;
    const height = tall ? 1.9 - t * 0.4 : 2.4 - t * 0.9;
    whorl(b, rng, y, radius, height, tall ? 8 : 9, rng.range(-0.3, 0.3));
  }
  // The leader at the top.
  whorl(b, rng, PINE_HEIGHT * 0.93, 0.5, 1.6, 5, 0);
  return b.build();
}

/** A distant pine: two cones on a stick, close to the same silhouette and color, at a tenth of the cost. */
export function pineLodGeometry(variant: number): THREE.BufferGeometry {
  const rng = new Rng(201 + variant * 7);
  const b = new MeshBuilder();
  const tall = variant === 1;
  b.limb(new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, 1, 0), PINE_HEIGHT * 0.6, 0.34, 0.12, 4, BARK);
  const tiers = tall ? [[0.52, 2.8, 3], [0.75, 2.1, 3.2]] : [[0.2, 3.6, 6.2], [0.6, 2.2, 6]];
  for (const [at, radius, height] of tiers) whorl(b, rng, PINE_HEIGHT * at, radius, height, 6, 0);
  return b.build();
}
