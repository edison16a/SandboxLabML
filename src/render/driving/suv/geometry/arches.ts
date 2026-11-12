import * as THREE from 'three';
import { archCut, bandCurve } from './body';
import { bothSides, gridGeometry, polygonGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { ARCH, ARCHED_BANDS, archFloor, AXLES, sectionAt, sillY } from './profile';
import { warp } from './warp';

/**
 * The inner wall of each wheel well. At full lock the front tire's inner
 * edge swings in to about 0.48 m, so the wall sits inboard of that.
 */
export const WELL_Z = 0.45;
const FLOOR_Y = 0.22;
const UNDER_SKIN = 0.012;

/** Where the side skin stands at height y on the section at x, as its z. */
function skinZ(x: number, y: number): number {
  for (let band = 0; band < ARCHED_BANDS; band++) {
    const pts = bandCurve(x, band, 16);
    for (let i = 0; i < pts.length - 1; i++) {
      const [z0, y0] = pts[i];
      const [z1, y1] = pts[i + 1];
      if (y0 <= y && y1 >= y) return z0 + ((z1 - z0) * (y - y0)) / (y1 - y0 || 1);
    }
  }
  return sectionAt(x).keys[0].z;
}

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
    // Below the hub the opening drops straight to the sill, and the trim follows it down on both sides.
    const legs = Math.max(2, Math.round(n / 5));
    const leg = (x: number, out: number) =>
      Array.from({ length: legs }, (_, k) => {
        const y = ARCH.centerY - ((ARCH.centerY - sillY(x)) * (legs - k)) / legs;
        return { x, z: skinZ(x + out * 0.002, y), y, ux: out, uy: 0 };
      });
    const ring = xs.map((x, i) => {
      const [z, y] = cuts[i];
      const r = Math.hypot(x - axle, y - ARCH.centerY) || 1;
      return { x, z, y, ux: (x - axle) / r, uy: (y - ARCH.centerY) / r };
    });
    const edge = [...leg(xs[0], -1), ...ring, ...leg(xs[n], 1).reverse()];
    const lip = edge.map(({ x, z, y, ux, uy }) => {
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
  // The side plates stop short of the sill line, so they never show past the rockers.
  const side = Math.min(...[0, front + ARCH.radius, rear - ARCH.radius, 2.15, -2.15].map((x) => sectionAt(x).keys[0].z)) - 0.02;
  bin.add('liner', plate(-2.15, 2.15, -WELL_Z, WELL_Z));
  bin.add('liner', bothSides(plate(rear + ARCH.radius, front - ARCH.radius, WELL_Z, side)));
  bin.add('liner', bothSides(plate(front + ARCH.radius, 2.15, WELL_Z, side)));
  bin.add('liner', bothSides(plate(-2.15, rear - ARCH.radius, WELL_Z, side)));
}
