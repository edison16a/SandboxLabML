/** Wheel size in meters. A large rim and a thin sidewall give the low profile look. */
export const WHEEL = { radius: 0.34, width: 0.27, rim: 0.262 };

/**
 * The car's footprint. Units are meters; +X is forward, +Y up, and the car
 * is centered on the origin. The tire marks and the simulation line up with
 * these numbers, so the body is shaped around them, never the other way.
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

/** Where the four wheels sit, front pair first, so steering can pick them out. */
export const WHEEL_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [CAR.axleFront, CAR.track],
  [CAR.axleFront, -CAR.track],
  [CAR.axleRear, CAR.track],
  [CAR.axleRear, -CAR.track],
];
