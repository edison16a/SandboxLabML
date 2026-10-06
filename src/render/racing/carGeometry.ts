import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rimGeometry, tireGeometry, WHEEL } from './wheelGeometry';

/**
 * A GT car built in code, so there is no model file to download. Units are
 * meters; +X is forward, +Y up, and the car is centered on its rear axle
 * line for natural steering pivots.
 */
export const CAR = {
  length: 4.5,
  width: 1.9,
  wheelRadius: WHEEL.radius,
  wheelWidth: WHEEL.width,
  /** Wheel centers along X (front, rear) and Z. */
  axleFront: 1.38,
  axleRear: -1.32,
  track: 0.8,
};

/**
 * The extrusion's rounded edge grows the outline outward by BEVEL, so the
 * profiles below are drawn that much inside the finished shape: an arch
 * drawn at 0.46 m ends up 0.4 m, just clear of the tire.
 */
const BEVEL = 0.06;
const ARCH = { radius: 0.4 + BEVEL, centerY: 0.3, floor: 0.2 + BEVEL };
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Points over a wheel arch, from its rear foot to its front foot along the floor line. */
function arch(axleX: number): Array<[number, number]> {
  const foot = Math.asin((ARCH.centerY - ARCH.floor) / ARCH.radius);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + foot - (i / 12) * (Math.PI + 2 * foot);
    pts.push([axleX + Math.cos(a) * ARCH.radius, ARCH.centerY + Math.sin(a) * ARCH.radius]);
  }
  return pts;
}

/** Extrudes a side profile across the car's width, centered on Z = 0, with rounded edges. */
function extrude(points: Array<[number, number]>, depth: number, bevel: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 6 });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

/**
 * Squeezes the width by height and by length: `narrow(x, y)` returns the
 * factor for Z. An extrusion has flat slab sides; this rounds the nose and
 * tail in plan and leans the flanks in toward the roof, which is most of
 * what makes a box read as a car.
 */
function warpWidth(g: THREE.BufferGeometry, narrow: (x: number, y: number) => number): THREE.BufferGeometry {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * narrow(p.getX(i), p.getY(i)));
  p.needsUpdate = true;
  return g;
}

export function bodyGeometry(): THREE.BufferGeometry {
  const profile: Array<[number, number]> = [
    [-2.18, 0.36],
    [-2.07, ARCH.floor],
    ...arch(CAR.axleRear),
    ...arch(CAR.axleFront),
    [2.11, ARCH.floor + 0.02],
    [2.26, 0.37],
    [2.24, 0.5],
    [2.01, 0.62],
    [1.09, 0.77],
    [0.77, 0.8],
    [-1.25, 0.83],
    [-1.95, 0.82],
    [-2.18, 0.74],
    [-2.23, 0.52],
  ];
  const g = extrude(profile, CAR.width, BEVEL);
  return warpWidth(g, (x, y) => (1 - 0.1 * smooth((x - 1.35) / 0.95) - 0.05 * smooth((-x - 1.5) / 0.75)) * (1 - 0.09 * smooth((y - 0.5) / 0.37)));
}

/** The glasshouse: raked windshield, roof and fastback rear window, narrower at the top. */
export function cabinGeometry(): THREE.BufferGeometry {
  const g = extrude(
    [
      [-1.62, 0.84],
      [0.72, 0.8],
      [0.02, 1.13],
      [-0.8, 1.16],
    ],
    1.6,
    0.08,
  );
  return warpWidth(g, (_, y) => 1 - 0.2 * smooth((y - 0.84) / 0.4));
}

/** Dark trim: front splitter, side skirts, rear diffuser and mirrors. */
export function trimGeometry(): THREE.BufferGeometry {
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z).toNonIndexed();
  const parts = [box(0.32, 0.035, 1.78, 2.2, 0.2, 0), box(0.22, 0.11, 1.36, -2.18, 0.27, 0)];
  for (const side of [-1, 1]) {
    parts.push(box(1.9, 0.07, 0.06, 0.03, 0.22, side * 0.94));
    parts.push(box(0.14, 0.09, 0.16, 0.5, 0.92, side * 0.86));
  }
  return mergeGeometries(parts) as THREE.BufferGeometry;
}

export function spoilerGeometry(): THREE.BufferGeometry {
  const wing = new THREE.BoxGeometry(0.36, 0.04, 1.66).translate(-1.98, 1.04, 0).toNonIndexed();
  const parts = [wing];
  for (const side of [-1, 1]) {
    parts.push(new THREE.BoxGeometry(0.4, 0.15, 0.025).translate(-1.98, 1.0, side * 0.84).toNonIndexed());
    parts.push(new THREE.BoxGeometry(0.07, 0.2, 0.05).translate(-1.95, 0.92, side * 0.5).toNonIndexed());
  }
  return mergeGeometries(parts) as THREE.BufferGeometry;
}

/** Headlights as two slim lamps; tail lights as one bar across the back, which reads well from the chase camera. */
export function lightGeometry(front: boolean): THREE.BufferGeometry {
  if (!front) return new THREE.BoxGeometry(0.05, 0.055, 1.5).translate(-2.27, 0.7, 0).toNonIndexed();
  const parts = [-1, 1].map((side) => new THREE.BoxGeometry(0.1, 0.06, 0.4).translate(2.27, 0.52, side * 0.58).toNonIndexed());
  return mergeGeometries(parts) as THREE.BufferGeometry;
}

/**
 * Mirrors a part across the car's centerline. Negative scale turns the
 * triangles inside out, so each triangle's winding is swapped back.
 */
export function mirrorZ(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = (g.index ? g.toNonIndexed() : g.clone()).scale(1, 1, -1);
  for (const name of Object.keys(m.attributes)) {
    const a = m.attributes[name];
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < a.itemSize; k++) {
        const t = a.getComponent(i + 1, k);
        a.setComponent(i + 1, k, a.getComponent(i + 2, k));
        a.setComponent(i + 2, k, t);
      }
    }
  }
  return m;
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
 * population and ghosts. The body is white so the per-instance color paints
 * it, while glass, trim and tires stay dark under any tint.
 */
export function mergedCarGeometry(): THREE.BufferGeometry {
  const wheels: THREE.BufferGeometry[] = [];
  for (const x of [CAR.axleFront, CAR.axleRear]) {
    for (const side of [1, -1]) {
      const place = (g: THREE.BufferGeometry) => (side > 0 ? g : mirrorZ(g)).translate(x, CAR.wheelRadius, side * CAR.track);
      wheels.push(painted(place(tireGeometry()), [0.03, 0.03, 0.035]));
      wheels.push(painted(place(rimGeometry()), [0.6, 0.62, 0.66]));
    }
  }
  const merged = mergeGeometries([
    painted(bodyGeometry(), [1, 1, 1]),
    painted(cabinGeometry(), [0.035, 0.05, 0.075]),
    painted(trimGeometry(), [0.05, 0.05, 0.06]),
    painted(spoilerGeometry(), [0.06, 0.06, 0.07]),
    painted(lightGeometry(false), [0.95, 0.1, 0.07]),
    painted(lightGeometry(true), [0.95, 0.95, 0.9]),
    ...wheels,
  ]) as THREE.BufferGeometry;
  merged.computeBoundingSphere();
  return merged;
}
