import { SUV, SUV_SIZE } from '@/engine/driving/car/params';

/** 22 inch wheels on low profile tires, m. */
export const WHEEL = { radius: 0.4, width: 0.295, rim: 0.29 };

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
  /**
   * Half track: wheel centers either side of the centerline. The body is
   * wider over the rear wheels, so the rear track is wider too and each
   * tire sits a little inside its own fender.
   */
  track: 0.82,
  trackFront: 0.792,
  trackRear: 0.82,
};

/** The four wheel centers (x, z), front pair first, so steering can pick them out. */
export const WHEEL_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [BODY.axleFront, BODY.trackFront],
  [BODY.axleFront, -BODY.trackFront],
  [BODY.axleRear, BODY.trackRear],
  [BODY.axleRear, -BODY.trackRear],
];
