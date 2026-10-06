import { hashObject } from '../../core/hash';

/**
 * Car model constants. The physics config is frozen when a run is created
 * and hashed onto every genome, so changing these means a new run.
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

export const DEFAULT_CAR: CarParams = {
  wheelbase: 2.6,
  accel: 8,
  brake: 13,
  topSpeed: 35,
  grip: 1.4,
  steerMax: 0.55,
  steerFadeSpeed: 12,
  steerRate: 2.5,
  rollingDrag: 0.25,
  airDrag: 0.0008,
  scrub: 0.35,
};

/** The forgiving preset for beginners: more grip, so corners are easier to survive. */
export const EASY_CAR: CarParams = { ...DEFAULT_CAR, grip: 2.0, brake: 16 };

export const CAR_PRESETS = { standard: DEFAULT_CAR, easy: EASY_CAR } as const;
export type CarPresetId = keyof typeof CAR_PRESETS;

export function physicsHash(params: CarParams, extra: Record<string, unknown> = {}): string {
  return hashObject({ ...params, ...extra });
}

/** Simulation step: 30 Hz, with two 60 Hz substeps inside for stability. */
export const SIM_DT = 1 / 30;
export const SUBSTEPS = 2;
