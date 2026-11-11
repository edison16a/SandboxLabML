import { CAR_DIMENSIONS, CAR_HATCH, CAR_SEDAN, CAR_TAXI, CAR_VAN } from '@/engine/driving/world/state';
import { profile } from '../suv/geometry/curve';

/**
 * The traffic body types as a few profiles along the car's length (x,
 * nose at +length/2): the body's half width, the belt line, and the top
 * line from the hood over the roof to the tail. Where the glass sits is a
 * range of x for the side windows and two more for the windshield and
 * rear window. Simple enough to draw dozens at once, shaped enough to read
 * as a saloon, a hatchback, a van or a cab at a glance.
 */
export interface CarShape {
  kind: number;
  length: number;
  width: number;
  wheelbase: number;
  wheelRadius: number;
  halfWidth: (x: number) => number;
  beltY: (x: number) => number;
  /** Height of the top surface along the centerline: hood, windshield, roof, rear glass, deck or hatch. */
  topY: (x: number) => number;
  /** Half width of the top surface's edge (the roof rail where there is a cabin). */
  topZ: (x: number) => number;
  /** Side glass from x0 to x1; windshield and rear window spans along x. */
  sideGlass: [number, number];
  windshield: [number, number];
  rearGlass: [number, number];
  /** A roof sign, for the cab. */
  roofSign: boolean;
}

function shape(kind: number, wheelbase: number, wheelRadius: number, top: Array<[number, number]>, belt: Array<[number, number]>, topZ: Array<[number, number]>, glass: { side: [number, number]; front: [number, number]; rear: [number, number] }, roofSign = false): CarShape {
  const [length, width] = CAR_DIMENSIONS[kind];
  const h = length / 2;
  const w = width / 2;
  return {
    kind,
    length,
    width,
    wheelbase,
    wheelRadius,
    halfWidth: profile([[-h, w * 0.88], [-h + 0.25, w * 0.98], [-h + 0.8, w], [h - 0.8, w], [h - 0.25, w * 0.97], [h, w * 0.86]]),
    beltY: profile(belt.map(([x, y]) => [x * h, y] as [number, number])),
    topY: profile(top.map(([x, y]) => [x * h, y] as [number, number])),
    topZ: profile(topZ.map(([x, z]) => [x * h, z * w] as [number, number])),
    sideGlass: [glass.side[0] * h, glass.side[1] * h],
    windshield: [glass.front[0] * h, glass.front[1] * h],
    rearGlass: [glass.rear[0] * h, glass.rear[1] * h],
    roofSign,
  };
}

/** Saloon: long hood, a cabin in the middle, a separate trunk. x is in half lengths, nose at +1. */
const SALOON_TOP: Array<[number, number]> = [[-1, 0.98], [-0.78, 1.02], [-0.62, 1.04], [-0.3, 1.4], [0.02, 1.44], [0.2, 1.42], [0.45, 1.06], [0.75, 0.98], [1, 0.86]];
const SALOON_BELT: Array<[number, number]> = [[-1, 0.92], [-0.6, 0.96], [0.4, 0.92], [1, 0.82]];
const SALOON_TOPZ: Array<[number, number]> = [[-1, 0.8], [-0.62, 0.86], [-0.3, 0.68], [0.2, 0.7], [0.45, 0.84], [1, 0.78]];

export const CAR_SHAPES: Record<number, CarShape> = {
  [CAR_SEDAN]: shape(CAR_SEDAN, 2.75, 0.32, SALOON_TOP, SALOON_BELT, SALOON_TOPZ, { side: [-0.58, 0.44], front: [0.2, 0.46], rear: [-0.62, -0.3] }),
  [CAR_TAXI]: shape(CAR_TAXI, 2.75, 0.32, SALOON_TOP, SALOON_BELT, SALOON_TOPZ, { side: [-0.58, 0.44], front: [0.2, 0.46], rear: [-0.62, -0.3] }, true),
  [CAR_HATCH]: shape(
    CAR_HATCH,
    2.55,
    0.31,
    [[-1, 1.0], [-0.94, 1.2], [-0.78, 1.44], [0.15, 1.47], [0.42, 1.06], [0.7, 0.96], [1, 0.84]],
    [[-1, 0.95], [-0.5, 0.95], [0.4, 0.91], [1, 0.82]],
    [[-1, 0.76], [-0.9, 0.7], [0.15, 0.7], [0.42, 0.84], [1, 0.78]],
    { side: [-0.8, 0.4], front: [0.15, 0.42], rear: [-0.98, -0.8] },
  ),
  [CAR_VAN]: shape(
    CAR_VAN,
    3.1,
    0.34,
    [[-1, 1.92], [-0.97, 1.98], [0.5, 1.98], [0.62, 1.86], [0.76, 1.18], [0.9, 1.08], [1, 0.95]],
    [[-1, 1.06], [0.5, 1.06], [0.8, 1.0], [1, 0.9]],
    [[-1, 0.86], [0.55, 0.86], [0.7, 0.84], [1, 0.8]],
    { side: [0.32, 0.72], front: [0.62, 0.78], rear: [-1.0, -0.99] },
  ),
};
