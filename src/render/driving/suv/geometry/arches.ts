import * as THREE from 'three';
import { archCut, bandCurve } from './body';
import { bothSides, gridGeometry, polygonGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { ARCH, ARCHED_BANDS, archFloor, AXLES, sectionAt } from './profile';
import { warp } from './warp';

/**
 * The inner wall of each wheel well. At full lock the front tire's inner
 * edge swings in to about 0.48 m, so the wall sits inboard of that.
 */
export const WELL_Z = 0.45;
const FLOOR_Y = 0.27;
const UNDER_SKIN = 0.012;

/** The skin height at (x, z) on the shoulder and belt bands, so the liner never pokes through the paint. */
function underSkin(x: number, z: number, y: number): number {
  let skin = Infinity;
  const bands = sectionAt(x).keys.length - 1;
  for (let band = ARCHED_BANDS - 1; band < bands; band++) {
    const pts = bandCurve(x, band, 16);
    for (let i = 0; i < pts.length - 1; i++) {
      const [z0, y0] = pts[i];
      const [z1, y1] = pts[i + 1];
      if (z0 !== z1 && (z0 - z) * (z1 - z) <= 0) skin = Math.min(skin, y0 + ((y1 - y0) * (z - z0)) / (z1 - z0));
    }
  }
  return Math.min(y, skin - UNDER_SKIN);
}

/**
 * Wheel wells: a gloss black trim rolled over each arch edge, a liner over the
 * tire, an inner wall and floor plates. The arches sit close round the
 * tires, so the wheels fill them as on a performance SUV.
 */
export function addArches(bin: PartBin, detail: Detail): void {
  const n = Math.max(6, Math.round(detail.archSteps * 1.6));
  for (const axle of AXLES) {
    const xs = Array.from({ length: n + 1 }, (_, i) => axle - Math.cos((Math.PI * i) / n) * (ARCH.radius - 0.001));
    const cuts = xs.map((x) => archCut(x) ?? ([0.95, archFloor(x)] as [number, number]));
    // A slim gloss black trim rolls over the arch edge and stands a few millimeters proud, so the arch reads as a crisp ring.
    const lip = xs.map((x, i) => {
      const [z, y] = cuts[i];
      const dx = x - axle;
      const r = Math.hypot(dx, y - ARCH.centerY) || 1;
      const ux = dx / r;
      const uy = (y - ARCH.centerY) / r;
      const pt = (out: number, lift: number): Vec3 => warp([x + ux * out, y + uy * out, z + lift]);
      return [pt(-0.014, -0.024), pt(-0.004, 0.005), pt(0.008, 0.011), pt(0.024, 0.007), pt(0.036, 0.0)];
    });
    bin.add('trim', bothSides(gridGeometry(lip)));
    const liner = xs.map((x, i) => {
      const [z, y] = cuts[i];
      const mid = Math.min(Math.max(sectionAt(x).keys[4].z - 0.02, WELL_Z + 0.01), z - 0.05);
      return [warp([x, underSkin(x, WELL_Z, y - 0.02), WELL_Z]), warp([x, underSkin(x, mid, y - 0.018), mid]), warp([x, y - 0.03, z - 0.03])];
    });
    bin.add('liner', bothSides(gridGeometry(liner)));
    const wall: Vec3[] = [...xs.map((x, i) => warp([x, underSkin(x, WELL_Z, cuts[i][1] - 0.02), WELL_Z])), warp([xs[n], FLOOR_Y, WELL_Z]), warp([xs[0], FLOOR_Y, WELL_Z])];
    bin.add('liner', bothSides(polygonGeometry(wall, [0, 0, 1])));
  }
}

/** Flat dark floor plates under the body, which only show from low angles but give the hollow shell a bottom. */
export function addUnderbody(bin: PartBin): void {
  const plate = (x0: number, x1: number, z0: number, z1: number) => new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2).translate((x0 + x1) / 2, FLOOR_Y, (z0 + z1) / 2);
  const [front, rear] = AXLES;
  bin.add('liner', plate(-2.2, 2.2, -WELL_Z, WELL_Z));
  bin.add('liner', bothSides(plate(rear + ARCH.radius, front - ARCH.radius, WELL_Z, 0.93)));
  bin.add('liner', bothSides(plate(front + ARCH.radius, 2.2, WELL_Z, 0.86)));
  bin.add('liner', bothSides(plate(-2.2, rear - ARCH.radius, WELL_Z, 0.9)));
}
