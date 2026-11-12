import * as THREE from 'three';

/**
 * The course draws on layer 1 as well as the default one. The main camera
 * sees it; a pass that should only see part of the scene can leave it out.
 */
export const GRID_LAYER = 1;

/** The characters' see through silhouettes draw on layer 3, which only the main camera sees. */
export const XRAY_LAYER = 3;

/**
 * Reusable math objects for one instanced component, so filling hundreds
 * of instances every frame allocates nothing.
 */
export interface Scratch {
  m: THREE.Matrix4;
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: THREE.Vector3;
  c: THREE.Color;
  up: THREE.Vector3;
  o: { x: number; z: number };
  /** A blended floor pose; things on the floor leave the elevation alone. */
  pose: { x: number; z: number; yaw: number; elevation: number };
  version: number;
}

export function makeScratch(): Scratch {
  return {
    m: new THREE.Matrix4(),
    p: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    s: new THREE.Vector3(1, 1, 1),
    c: new THREE.Color(),
    up: new THREE.Vector3(0, 1, 0),
    o: { x: 0, z: 0 },
    pose: { x: 0, z: 0, yaw: 0, elevation: 0 },
    version: -1,
  };
}

/** Writes one instance transform: a floor position, a yaw and a scale. */
export function placeInstance(mesh: THREE.InstancedMesh, i: number, t: Scratch, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number): void {
  t.p.set(x, y, z);
  t.q.setFromAxisAngle(t.up, yaw);
  t.s.set(sx, sy, sz);
  t.m.compose(t.p, t.q, t.s);
  mesh.setMatrixAt(i, t.m);
}

/** Marks instance buffers dirty after a fill. */
export function commit(mesh: THREE.InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
