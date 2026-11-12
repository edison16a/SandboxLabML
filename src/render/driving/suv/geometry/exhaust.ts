import * as THREE from 'three';
import { onCap } from './cap';
import { bothSides, merge } from './grid';
import type { Detail, PartBin } from './parts';

/**
 * The tailpipes, two each side in the diffuser, m: where they sit across
 * the face, their height, radius and how much flatter than round they
 * are, how far the lip stands out of the face and how deep the throat runs.
 */
const PIPES = { at: [0.4, 0.535], y: 0.465, r: 0.043, squash: 0.74, out: 0.024, wall: 0.0045, deep: 0.05 };

/**
 * One tailpipe along +y, centered on the axis: a polished tube with a
 * rolled lip, and a dark throat running back into the body with a dark
 * end, so it reads as a real pipe from any angle. Profiles walk with the
 * visible side on the right, as three's lathe expects.
 */
function pipe(segments: number, full: boolean): { metal: THREE.BufferGeometry; throat: THREE.BufferGeometry } {
  const { r, out, wall, deep } = PIPES;
  const lip: Array<[number, number]> = full
    ? [[r, -0.045], [r, out - 0.005], [r - 0.0012, out - 0.0006], [r - wall * 0.5, out], [r - wall + 0.0006, out - 0.001], [r - wall, out - 0.004]]
    : [[r, -0.045], [r, out]];
  const lathe = (pts: Array<[number, number]>) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), segments);
  const inner = r - wall;
  const end = new THREE.CircleGeometry(full ? inner : r, segments).rotateX(-Math.PI / 2).translate(0, full ? -deep : out - 0.004, 0);
  const throat = full ? merge([lathe([[inner, out - 0.004], [inner, -deep]]), end]) : end;
  return { metal: lathe(lip), throat };
}

/**
 * Lays a pipe built along +y onto the tail face at (z, y), pointing
 * straight back and level, as real pipes do, whatever the slope of the
 * diffuser it stands out of.
 */
function placed(g: THREE.BufferGeometry, z: number): THREE.BufferGeometry {
  const n = new THREE.Vector3(-1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3().crossVectors(n, up);
  // Local x runs across, y out of the face and z up, squashed so the pipe is a little flatter than round.
  const m = new THREE.Matrix4().makeBasis(across, n, up.multiplyScalar(PIPES.squash));
  m.setPosition(new THREE.Vector3(...onCap(-1, z, PIPES.y, 0)));
  return g.applyMatrix4(m);
}

/** The four tailpipes, each a short polished tube set in the diffuser with a dark throat. */
export function addPipes(bin: PartBin, detail: Detail): void {
  const full = detail.fine || detail.brakes;
  const segments = detail.fine ? 18 : detail.brakes ? 12 : 6;
  for (const z of PIPES.at) {
    const { metal, throat } = pipe(segments, full);
    bin.add('metal', bothSides(placed(metal, z)));
    bin.add('liner', bothSides(placed(throat, z)));
  }
}
