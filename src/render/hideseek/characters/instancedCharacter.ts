import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { setTintMask } from '../grid/tintMaskMaterial';
import { faceGeometry } from './characterFace';
import { armGeometry, bodyGeometry, headGeometry, RIG } from './characterGeometry';

/** Gives a part one flat vertex color, keeping only what the merged mesh needs. */
function paint(g: THREE.BufferGeometry, color: number, tint: number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(color), 3));
  return setTintMask(geo, tint);
}

/**
 * The whole character in its resting pose as one coarse mesh, for drawing
 * a hundred of them in one instanced call on the arena grid. Body, head
 * and arms take the instance color (the team color); the face stays white.
 * About 700 triangles, and the same silhouette as the full character.
 */
export function instancedCharacterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(bodyGeometry('instanced'), 1, 1));
  const head = new THREE.Matrix4().compose(new THREE.Vector3(0, RIG.headY, 0), new THREE.Quaternion(), new THREE.Vector3(...RIG.headScale));
  parts.push(paint(headGeometry('instanced').applyMatrix4(head), 1, 1));
  parts.push(paint(faceGeometry('happy', true).applyMatrix4(head), 1.6, 0));
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Matrix4().compose(
      new THREE.Vector3(0, RIG.shoulderY, side * RIG.shoulderZ),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -side * RIG.restSplay),
      new THREE.Vector3(1, 1, 1),
    );
    parts.push(paint(armGeometry('instanced').applyMatrix4(shoulder), 1, 1));
  }
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}
