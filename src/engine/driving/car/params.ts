import { hashObject } from '../../core/hash';

/**
 * The SUV's model constants: a kinematic bicycle with a grip limit, tuned
 * for a 2.1 tonne SUV at city speeds. Frozen
 * when a run is created and hashed onto every genome, so changing these
 * means a new run.
 */
export interface CarParams {
  /** Wheelbase, m. */
  wheelbase: number;
  /** Peak drive acceleration, m/s^2. */
  accel: number;
  /** Peak braking deceleration, m/s^2. */
  brake: number;
  /** Speed where drive force fades to zero, m/s. */
  topSpeed: number;
  /** Tire grip coefficient. Grip limit is mu * g. */
  grip: number;
  /** Steering angle at standstill, rad. */
  steerMax: number;
  /** Speed at which available steering halves, m/s. */
  steerFadeSpeed: number;
  /** Max steering angle change rate, rad/s. */
  steerRate: number;
  rollingDrag: number;
  airDrag: number;
  /** How hard understeer scrubs speed, per unit of excess lateral demand. */
  scrub: number;
}

export const GRAVITY = 9.81;

export const SUV: CarParams = {
  wheelbase: 2.9,
  accel: 4.6,
  brake: 9,
  topSpeed: 24,
  grip: 1.0,
  steerMax: 0.62,
  steerFadeSpeed: 16,
  steerRate: 2.4,
  rollingDrag: 0.18,
  airDrag: 0.0007,
  scrub: 0.4,
};

/** The SUV's footprint, m. Collisions, the curb check and the renderer all use these. */
export const SUV_SIZE = { length: 4.9, width: 2.0 };

export function physicsHash(params: CarParams, extra: Record<string, unknown> = {}): string {
  return hashObject({ ...params, ...extra });
}

/** Simulation step: 30 Hz, with two 60 Hz substeps inside for stability. */
export const SIM_DT = 1 / 30;
export const SUBSTEPS = 2;
