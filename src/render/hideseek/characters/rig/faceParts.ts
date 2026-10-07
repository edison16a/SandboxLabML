import * as THREE from 'three';
import { EXPRESSIONS, type Expression } from '../motion/pose';
import { BONE } from './bones';
import { arcStroke, ellipse, grin, headPoint, pill, wrapOnHead } from './faceShapes';
import { mergeParts, rigid, segments, type MeshDetail } from './parts';
import { RIG } from './proportions';

/** Elevation of the mouth's middle on the face, rad: close under the eyes, like a young face. */
export const MOUTH_ELEVATION = -0.3;

const WHITE = '#f6f8fb';
const IRIS = '#141a36';
const PUPIL = '#030409';
const SHINE = '#ffffff';
const MOUTH = '#3a0c1d';
const TONGUE = '#ff6b84';
const TEETH = '#f4f4ef';

/** The shapes of each mouth, as layers drawn back to front: the dark inside, then tongue or teeth. */
function mouthLayers(e: Expression): Array<{ shapes: THREE.Shape[]; color: string }> {
  switch (e) {
    case 'happy':
      return [
        { shapes: [grin(0, 0, 0.085, 0.07)], color: MOUTH },
        { shapes: [ellipse(0, -0.043, 0.042, 0.02)], color: TONGUE },
      ];
    case 'startled':
      return [
        { shapes: [ellipse(0, -0.005, 0.04, 0.054)], color: MOUTH },
        { shapes: [ellipse(0, -0.037, 0.023, 0.011)], color: TONGUE },
      ];
    case 'keen':
      return [{ shapes: [arcStroke(0, 0.05, 0.075, Math.PI + 0.62, 2 * Math.PI - 0.62, 0.019)], color: MOUTH }];
    case 'effort':
      return [
        { shapes: [pill(0, 0, 0.13, 0.044)], color: MOUTH },
        { shapes: [pill(0, 0.005, 0.108, 0.02)], color: TEETH },
      ];
    case 'sleep':
      return [{ shapes: [ellipse(0, 0, 0.024, 0.018)], color: MOUTH }];
  }
}

/** A cap of a sphere of radius `r` round the +x axis, `angle` rad wide, then turned up by `pitch` and to the left by `yaw`. */
function cap(r: number, angle: number, pitch: number, yaw: number, detail: MeshDetail): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, segments(detail, 20, 10, 6), segments(detail, 4, 2, 1), 0, Math.PI * 2, 0, angle);
  g.rotateZ(-Math.PI / 2);
  g.rotateZ(pitch);
  g.rotateY(yaw);
  return g;
}

/**
 * The mouth bone of each expression sits at that mouth's middle on the
 * face, so showing a mouth scales it up from there. Shared by the rig,
 * which places the bones, and the meshes built round them.
 */
export const MOUTH_CENTER = headPoint(0, 0, MOUTH_ELEVATION, 0, new THREE.Vector3());

/**
 * The face as one skinned mesh in its own glossy material: eyeballs,
 * pupils that turn with their bones, catch lights that stay put as the
 * pupils move (like a reflection would), and one mouth per expression.
 * `only` keeps a single mouth, for the instanced crowds.
 */
export function faceGeometry(detail: MeshDetail, only?: Expression): THREE.BufferGeometry {
  const r = RIG.eye.radius;
  const parts: THREE.BufferGeometry[] = [];
  for (let side = 0; side < 2; side++) {
    const s = segments(detail, 22, 12, 6);
    parts.push(rigid(new THREE.SphereGeometry(r, s, Math.round(s * 0.7)), BONE.eye[side], WHITE));
    parts.push(rigid(cap(r + 0.0015, 0.6, 0, 0, detail), BONE.pupil[side], IRIS));
    parts.push(rigid(cap(r + 0.0028, 0.34, 0, 0, detail), BONE.pupil[side], PUPIL));
    parts.push(rigid(cap(r + 0.004, 0.17, 0.42, 0.3, detail), BONE.eye[side], SHINE));
    if (detail !== 'instanced') parts.push(rigid(cap(r + 0.004, 0.075, -0.22, -0.3, detail), BONE.eye[side], SHINE));
  }
  EXPRESSIONS.forEach((e, i) => {
    if (only && e !== only) return;
    mouthLayers(e).forEach((layer, k) => {
      parts.push(rigid(wrapOnHead(layer.shapes, MOUTH_ELEVATION, 0.004 + k * 0.0016, segments(detail, 10, 5, 3), MOUTH_CENTER), BONE.mouth[i], layer.color));
    });
  });
  return mergeParts(parts);
}
