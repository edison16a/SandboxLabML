import { SUV, SUV_SIZE } from '@/engine/driving/car/params';

/** 21 inch wheels on low profile tires, m. */
export const WHEEL = { radius: 0.375, width: 0.29, rim: 0.272 };

/**
 * The SUV's frame. +X is forward, +Y up, Z across with +Z on the left, and
 * the car is centered on the origin at road level. The footprint and the
 * wheelbase are the simulation's, so the body is shaped around them.
 */
export const BODY = {
  length: SUV_SIZE.length,
  width: SUV_SIZE.width,
  nose: SUV_SIZE.length / 2,
  tail: -SUV_SIZE.length / 2,
  /** Wheel centers along X, front and rear, a wheelbase apart. */
  axleFront: SUV.wheelbase / 2 + 0.03,
  axleRear: -SUV.wheelbase / 2 + 0.03,
  /** Half track: wheel centers either side of the centerline. */
  track: 0.845,
};

/** The four wheel centers (x, z), front pair first, so steering can pick them out. */
export const WHEEL_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [BODY.axleFront, BODY.track],
  [BODY.axleFront, -BODY.track],
  [BODY.axleRear, BODY.track],
  [BODY.axleRear, -BODY.track],
];
