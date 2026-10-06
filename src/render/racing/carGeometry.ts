import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A low-poly GT car built from extruded side profiles, so there is no model
 * file to download. Units are meters; +X is forward, +Y up, and the car is
 * centered on its rear axle line for natural steering pivots.
 */
export const CAR = {
  length: 4.5,
  width: 1.9,
  wheelRadius: 0.34,
  wheelWidth: 0.27,
  /** Wheel centers along X (front, rear) and Z. */
  axleFront: 1.38,
  axleRear: -1.32,
  track: 0.83,
};

function profile(points: Array<[number, number]>, depth: number, bevel: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

export function bodyGeometry(): THREE.BufferGeometry {
  return profile(
    [
      [-2.15, 0.24],
      [2.05, 0.22],
      [2.26, 0.36],
      [2.2, 0.5],
      [1.15, 0.74],
      [0.75, 0.8],
      [-1.2, 0.84],
      [-2.05, 0.8],
      [-2.24, 0.62],
    ],
    CAR.width,
    0.09,
  );
}

export function cabinGeometry(): THREE.BufferGeometry {
  return profile(
    [
      [-1.25, 0.8],
      [0.85, 0.76],
      [0.25, 1.2],
      [-0.75, 1.23],
    ],
    1.56,
    0.07,
  );
}

export function wheelGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, CAR.wheelWidth, 18, 1);
  g.rotateX(Math.PI / 2);
  return g;
}

export function rimGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(CAR.wheelRadius * 0.62, CAR.wheelRadius * 0.62, CAR.wheelWidth + 0.02, 10, 1);
  g.rotateX(Math.PI / 2);
  return g;
}

export function spoilerGeometry(): THREE.BufferGeometry {
  const wing = new THREE.BoxGeometry(0.34, 0.05, 1.7);
  wing.translate(-2.02, 1.02, 0);
  const postL = new THREE.BoxGeometry(0.08, 0.2, 0.06);
  postL.translate(-1.98, 0.9, 0.55);
  const postR = postL.clone();
  postR.translate(0, 0, -1.1);
  return mergeGeometries([wing.toNonIndexed(), postL.toNonIndexed(), postR.toNonIndexed()]) as THREE.BufferGeometry;
}

export function lightGeometry(front: boolean): THREE.BufferGeometry {
  const parts = [-1, 1].map((side) => {
    const g = new THREE.BoxGeometry(0.06, 0.1, 0.42);
    g.translate(front ? 2.2 : -2.22, front ? 0.47 : 0.66, side * 0.62);
    return g.toNonIndexed();
  });
  return mergeGeometries(parts) as THREE.BufferGeometry;
}

function painted(g: THREE.BufferGeometry, color: [number, number, number]): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set(color, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return geo;
}

/**
 * Every part merged into one geometry with vertex colors, for the instanced
 * population. The body is white so the per-instance color paints it, while
 * glass and tires stay dark under any tint.
 */
export function mergedCarGeometry(): THREE.BufferGeometry {
  const wheels: THREE.BufferGeometry[] = [];
  for (const x of [CAR.axleFront, CAR.axleRear]) {
    for (const z of [CAR.track, -CAR.track]) {
      const w = wheelGeometry();
      w.translate(x, CAR.wheelRadius, z);
      wheels.push(painted(w, [0.035, 0.035, 0.04]));
      const r = rimGeometry();
      r.translate(x, CAR.wheelRadius, z);
      wheels.push(painted(r, [0.55, 0.57, 0.6]));
    }
  }
  const merged = mergeGeometries([
    painted(bodyGeometry(), [1, 1, 1]),
    painted(cabinGeometry(), [0.04, 0.06, 0.09]),
    painted(spoilerGeometry(), [0.08, 0.08, 0.09]),
    painted(lightGeometry(false), [0.9, 0.08, 0.06]),
    painted(lightGeometry(true), [0.95, 0.95, 0.88]),
    ...wheels,
  ]) as THREE.BufferGeometry;
  merged.computeBoundingSphere();
  return merged;
}
