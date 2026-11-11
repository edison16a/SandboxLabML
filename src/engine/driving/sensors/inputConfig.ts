/**
 * Which inputs a driving brain gets, by group. Chosen when a run is created
 * and frozen afterwards, because input nodes and innovation numbers depend
 * on it.
 */
export interface DrivingInputConfig {
  /** Lidar beams around the car: distance to the first thing each one hits. */
  lidar: {
    count: number;
    /** Total field of view, rad, centered straight ahead. */
    fov: number;
    /** Max beam length, m. */
    range: number;
  };
  /** One more input per beam saying what it hit: a curb or building, a car, or a person. */
  lidarKinds: boolean;
  /** Offset from the lane center, heading error, the bearing to the lane just ahead and the curve ahead at two distances. */
  lane: boolean;
  /** Next maneuver, how far until it starts (the stop line at a signal) and distance to the destination. */
  route: boolean;
  /** The signal ahead and how far its stop line is. */
  light: boolean;
  /** The nearest car ahead in the lane: gap and relative speed. */
  carAhead: boolean;
  /** The nearest person in or near the path: distance and sideways offset. */
  pedestrian: boolean;
  /** Own speed and the speed limit. */
  speed: boolean;
  /** Gaussian sensor noise as a fraction of each input's range, 0 to 0.1. */
  noise: number;
}

export const DRIVING_INPUT_GROUPS = ['lane', 'route', 'light', 'carAhead', 'pedestrian', 'speed'] as const;
export type DrivingInputGroup = (typeof DRIVING_INPUT_GROUPS)[number];

/** Lookahead distances for the two curvature inputs, m. */
export const CURVE_NEAR = 8;
export const CURVE_FAR = 25;
/** Curvature input = curvature / this, clamped. 1/5 m is the tightest turn in town. */
export const CURVE_SCALE = 1 / 5;
/** Range of the distance inputs, m: past this they read as far away. */
export const STOP_RANGE = 80;
export const DEST_RANGE = 60;
export const GAP_RANGE = 50;
export const PED_RANGE = 40;
/** Relative speed and sideways offset that read as full scale. */
export const REL_SPEED_SCALE = 15;
export const PED_LATERAL_SCALE = 5;
/** People this far either side of the path count as in or near it, m. */
export const PED_CORRIDOR = 4.5;
/** Cars this far either side of the path count as in the lane, m. */
export const CAR_CORRIDOR = 2;

/** The starter set: a light lidar ring plus every dedicated sensor. */
export const STANDARD_DRIVING_INPUTS: DrivingInputConfig = {
  lidar: { count: 9, fov: (Math.PI * 4) / 3, range: 40 },
  lidarKinds: false,
  lane: true,
  route: true,
  light: true,
  carAhead: true,
  pedestrian: true,
  speed: true,
  noise: 0,
};

/** Everything on: a dense lidar ring that also says what each beam hit. */
export const FULL_DRIVING_INPUTS: DrivingInputConfig = {
  ...STANDARD_DRIVING_INPUTS,
  lidar: { count: 15, fov: (Math.PI * 3) / 2, range: 40 },
  lidarKinds: true,
};

/** Beam directions relative to the car, from left to right. */
export function lidarAngles(count: number, fov: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => fov / 2 - (fov * i) / (count - 1));
}
