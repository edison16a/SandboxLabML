/**
 * The slope the motion model is tuned for: a ramp 2.4 m long and 1.2 m
 * high. Courses have no ramps, so climbing never starts there, but the
 * gait, the lean and the crouch keep this tuning for any world that adds
 * a slope.
 */
export const RAMP = { length: 2.4, height: 1.2 } as const;
