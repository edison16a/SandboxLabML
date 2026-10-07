import * as THREE from 'three';
import type { HsFrame } from '../frame/sceneContext';
import { cityEdgeFrom, farPlane, hazeRange } from '../scene/haze';

/** Scratch for the haze range, so fitting depth every frame allocates nothing. */
const haze = { near: 0, far: 0 };

/**
 * Near and far planes follow the viewing distance. Depth precision is
 * spread between them, so a near plane fit for first person views would
 * make the thin floor markings flicker when seen from 200 m away. The
 * haze follows it too, so the city fades out from any orbit, and the far
 * plane always lies past the end of the haze. `distance` is from the
 * camera to the point it orbits, 0 for a first person view.
 */
export function fitDepthRange(camera: THREE.PerspectiveCamera, scene: THREE.Scene, frame: HsFrame, distance: number, target: THREE.Vector3): void {
  const fog = scene.fog as THREE.Fog | null;
  if (fog) {
    hazeRange(distance, cityEdgeFrom(target.x, target.z, frame.lattice.width / 2, frame.lattice.depth / 2), haze);
    fog.near = haze.near;
    fog.far = haze.far;
  }
  const near = THREE.MathUtils.clamp(distance * 0.012, 0.05, 4);
  const far = farPlane(distance);
  if (Math.abs(camera.near - near) > near * 0.1 || Math.abs(camera.far - far) > far * 0.1) {
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
  }
}
