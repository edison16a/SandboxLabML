/**
 * Which inputs a racing brain gets. Chosen when a run is created and frozen
 * afterwards, because input nodes and innovation numbers depend on it.
 */
export interface RacingInputConfig {
  rays: {
    count: number;
    /** Total field of view, rad. Rays are spread evenly across it. */
    fov: number;
    /** Max ray length, m. */
    range: number;
  };
  speed: boolean;
  headingError: boolean;
  steerAngle: boolean;
  curvatureNear: boolean;
  curvatureFar: boolean;
  slip: boolean;
  /** Gaussian sensor noise as a fraction of each input's range, 0 to 0.1. */
  noise: number;
}

export const RACING_SCALARS = ['speed', 'headingError', 'steerAngle', 'curvatureNear', 'curvatureFar', 'slip'] as const;
export type RacingScalar = (typeof RACING_SCALARS)[number];

/** Distances used by the curvature lookahead inputs, m. */
export const CURVATURE_NEAR = 15;
export const CURVATURE_FAR = 40;

/** Curvature input = curvature / this, clamped to [-1, 1]. 1/20 m is a tight bend. */
export const CURVATURE_SCALE = 1 / 20;

export const STANDARD_RACING_INPUTS: RacingInputConfig = {
  rays: { count: 9, fov: Math.PI, range: 60 },
  speed: true,
  headingError: true,
  steerAngle: false,
  curvatureNear: false,
  curvatureFar: false,
  slip: false,
  noise: 0,
};

/** Ray directions relative to the car, from left to right. */
export function rayAngles(count: number, fov: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => fov / 2 - (fov * i) / (count - 1));
}
