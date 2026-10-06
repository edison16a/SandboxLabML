import * as THREE from 'three';
import { ARCHED_BANDS, archCut, bandPoints } from './body';
import { ARCH, archFloor, AXLES, sectionAt } from './bodyProfile';
import { bothSides, gridGeometry, polygonGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { warp } from './warp';

/**
 * The inner wall of each wheel well. At full steering lock the front
 * tire's inner edge swings in to about 0.51, so the wall sits inboard of
 * that. A unit test checks it against the engine's steering limit.
 */
export const WELL_Z = 0.49;
const FLOOR_Y = 0.115;
/** How far the well stays under the paint where the hood dips below the arch line. */
const UNDER_SKIN = 0.012;

/**
 * Wheel wells: a painted lip rolled under the arch edge, a dark liner over
 * the tire, a dark inner wall and end walls where the arch drops to the
 * sill. Without them the arches show straight through the hollow body.
 */
export function addArches(bin: PartBin, detail: Detail): void {
  const n = Math.max(8, Math.round(detail.archSteps * 1.5));
  for (const axle of AXLES) {
    const xs = Array.from({ length: n + 1 }, (_, i) => axle - ARCH.foot + 0.001 + ((2 * ARCH.foot - 0.002) * i) / n);
    const cuts = xs.map((x) => archCut(x) ?? ([0.9, archFloor(x)] as [number, number]));
    // Lip rows run inner to outer so its face points down and out from under the arch.
    const lip = xs.map((x, i) => {
      const [z, y] = cuts[i];
      return [warp([x, y - 0.012, z - 0.045]), warp([x, y - 0.009, z - 0.02]), warp([x, y, z])];
    });
    bin.add('paint', bothSides(gridGeometry(lip)));
    // The middle point sits under the hood edge crease, the one dip in the skin, so the liner can follow it down.
    const liner = xs.map((x, i) => {
      const [z, y] = cuts[i];
      const crease = Math.min(Math.max(sectionAt(x).keys[5][0], WELL_Z + 0.01), z - 0.05);
      return [warp([x, underSkin(x, WELL_Z, y - 0.014), WELL_Z]), warp([x, underSkin(x, crease, y - 0.013), crease]), warp([x, y - 0.012, z - 0.04])];
    });
    bin.add('liner', bothSides(gridGeometry(liner)));
    const wall: Vec3[] = [...xs.map((x, i) => warp([x, underSkin(x, WELL_Z, cuts[i][1] - 0.014), WELL_Z])), warp([xs[n], FLOOR_Y, WELL_Z]), warp([xs[0], FLOOR_Y, WELL_Z])];
    bin.add('liner', bothSides(polygonGeometry(wall, [0, 0, 1])));
    bin.add('liner', bothSides(footWall(xs[0] - 0.002, cuts[0][1], 1)));
    bin.add('liner', bothSides(footWall(xs[n] + 0.002, cuts[n][1], -1)));
  }
}

/**
 * A well height at (x, z), lowered where needed to stay under the body.
 * Over the front wheels the hood dips below the arch line, and a liner at
 * full arch height would poke up through the paint there.
 */
function underSkin(x: number, z: number, y: number): number {
  let skin = Infinity;
  // The highest arched band and every band above it, up to the centerline.
  const bands = sectionAt(x).keys.length - 1;
  for (let band = ARCHED_BANDS - 1; band < bands; band++) {
    const pts = bandPoints(x, band, 16);
    for (let i = 0; i < pts.length - 1; i++) {
      const [z0, y0] = pts[i];
      const [z1, y1] = pts[i + 1];
      if (z0 !== z1 && (z0 - z) * (z1 - z) <= 0) skin = Math.min(skin, y0 + ((y1 - y0) * (z - z0)) / (z1 - z0));
    }
  }
  return Math.min(y, skin - UNDER_SKIN);
}

/**
 * Where an arch drops straight down to the sill, the skin just outside it
 * ends in an open edge. This wall closes it, from the skin in to the well,
 * facing the wheel.
 */
function footWall(x: number, top: number, facing: 1 | -1): THREE.BufferGeometry {
  const skin = [0, 1, 2].flatMap((band) => bandPoints(x, band, 4)).filter(([, y]) => y < top);
  const pts: Vec3[] = [warp([x, FLOOR_Y, WELL_Z]), ...skin.map(([z, y]) => warp([x, y, z])), warp([x, top, skin[skin.length - 1][0]]), warp([x, top, WELL_Z])];
  return polygonGeometry(pts, [facing, 0, 0]);
}

/**
 * A flat dark floor: a center plate the length of the car and side plates
 * between and beyond the wheel wells. It only shows from low angles, where
 * an open bottom would give the hollow body away.
 */
export function addUnderbody(bin: PartBin): void {
  const plate = (x0: number, x1: number, z0: number, z1: number) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2);
    return g.translate((x0 + x1) / 2, FLOOR_Y, (z0 + z1) / 2);
  };
  const [front, rear] = AXLES;
  bin.add('liner', plate(-1.8, 2.0, -WELL_Z, WELL_Z));
  bin.add('liner', bothSides(plate(rear + ARCH.foot, front - ARCH.foot, WELL_Z, 0.86)));
  bin.add('liner', bothSides(plate(front + ARCH.foot, 2.02, WELL_Z, 0.72)));
}
