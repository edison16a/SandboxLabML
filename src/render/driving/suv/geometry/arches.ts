import * as THREE from 'three';
import { archCut, bandCurve } from './body';
import { bothSides, gridGeometry, polygonGeometry, type Vec3 } from './grid';
import { flareRows, skinAt } from './flares';
import { lightest, type Detail, type PartBin } from './parts';
import { ARCH, ARCHED_BANDS, archFloor, AXLES, sectionAt, sillY } from './profile';
import { warp } from './warp';

/**
 * The inner wall of each wheel well. At full lock the front tire's inner
 * edge swings in to about 0.42 m, so the wall sits inboard of that.
 */
export const WELL_Z = 0.4;
const FLOOR_Y = 0.22;
const UNDER_SKIN = 0.012;

/** The skin height at (x, z) on the bands above the side, so the liner never pokes through the paint. */
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
 * A strip laid along the arch's edge. Rows climb the edge from the rear
 * leg over the top to the front leg, and each row runs from the skin into
 * the opening; that order faces into the body, so each row is walked
 * backwards to face the wheel and the street.
 */
const towardWheel = (rows: Vec3[][]) => gridGeometry(rows.map((row) => [...row].reverse()));

/**
 * Wheel wells: a satin black flare round each arch (flares.ts), a liner
 * over the tire, an inner wall and floor plates. The arches sit about
 * 5 cm clear of the tires, so the wheels fill them as on a performance
 * SUV. The flare and the liner run the whole edge, down the legs too, so
 * the well is closed fore and aft and no view through the opening can
 * see into the hollow body.
 */
export function addArches(bin: PartBin, detail: Detail): void {
  // The far population walks the arch on the body's own stations, so the flare's roll lies on the skin's cut and
  // no sliver of paint shows inside it between two coarse stations.
  const n = detail.brakes ? Math.max(6, Math.round(detail.archSteps * 1.6)) : detail.archSteps;
  for (const axle of AXLES) {
    const xs = Array.from({ length: n + 1 }, (_, i) => axle - Math.cos((Math.PI * i) / n) * (ARCH.radius - 0.001));
    const cuts = xs.map((x) => archCut(x) ?? ([0.95, archFloor(x)] as [number, number]));
    // Below the hub the opening drops straight to the sill, and the edge follows it down on both sides. The lightest
    // population car spends its triangles on a rounder arch instead and takes each straight leg in one step.
    const legs = lightest(detail) ? 1 : Math.max(2, Math.round(n / 5));
    const leg = (x: number, out: number) =>
      Array.from({ length: legs }, (_, k) => {
        const y = ARCH.centerY - ((ARCH.centerY - sillY(x)) * (legs - k)) / legs;
        return { x, z: skinAt(x + out * 0.002, y).z, y, ux: out, uy: 0, ring: false };
      });
    const ring = xs.map((x, i) => {
      const [z, y] = cuts[i];
      const r = Math.hypot(x - axle, y - ARCH.centerY) || 1;
      return { x, z, y, ux: (x - axle) / r, uy: (y - ARCH.centerY) / r, ring: true };
    });
    const edge = [...leg(xs[0], -1), ...ring, ...leg(xs[n], 1).reverse()];
    const trim = flareRows(edge, detail);
    bin.add('clad', bothSides(towardWheel(trim)));
    // From the inner wall, up over the tire, to the trim's inner edge; over the legs it is a flat end wall.
    const liner = edge.map(({ x, z, y, ring: over }, k) => {
      const inner = trim[k][trim[k].length - 1];
      const mid = Math.min(Math.max(sectionAt(x).keys[5].z - 0.02, WELL_Z + 0.01), z - 0.05);
      if (!over) return [warp([x, y, WELL_Z]), warp([x, y, mid]), inner];
      return [warp([x, underSkin(x, WELL_Z, y - 0.02), WELL_Z]), warp([x, underSkin(x, mid, y - 0.024), mid]), inner];
    });
    bin.add('liner', bothSides(gridGeometry(liner)));
    const wall: Vec3[] = [...xs.map((x, i) => warp([x, underSkin(x, WELL_Z, cuts[i][1] - 0.02), WELL_Z])), warp([xs[n], FLOOR_Y, WELL_Z]), warp([xs[0], FLOOR_Y, WELL_Z])];
    bin.add('liner', bothSides(polygonGeometry(wall, [0, 0, 1])));
  }
}

/** Flat dark floor plates under the body, which only show from low angles but give the hollow shell a bottom. */
export function addUnderbody(bin: PartBin): void {
  const plate = (x0: number, x1: number, half: number, y = FLOOR_Y) => new THREE.PlaneGeometry(x1 - x0, 2 * half).rotateX(Math.PI / 2).translate((x0 + x1) / 2, y, 0);
  // Each plate stops short of the sill line at its narrowest station, so it never shows past the sill trim.
  const inside = (...xs: number[]) => Math.min(...xs.map((x) => sectionAt(x).keys[0].z)) - 0.02;
  const [front, rear] = AXLES;
  const [f0, f1, r0, r1] = [front - ARCH.radius, front + ARCH.radius, rear - ARCH.radius, rear + ARCH.radius];
  bin.add('liner', plate(r1, f0, inside(r1, 0, f0)), plate(f0, f1, WELL_Z), plate(r0, r1, WELL_Z));
  // Ahead of and behind the wheels the floor rises with the sill, so it never hangs below the bumpers.
  bin.add('liner', plate(f1, 2.2, inside(2.2), sillY(2.2) + 0.012), plate(-2.12, r0, inside(-2.12), sillY(-2.12) + 0.012));
}
