import type { SnapshotLayout } from '../env/types';

/**
 * 10 floats per learner, for the population stream and the ghost stream.
 * The layout and its flag bits live in a file with no simulation imports,
 * so the env's light info can name the layout.
 */
export const DRIVING_SNAPSHOT: SnapshotLayout = {
  stride: 10,
  fields: ['x', 'y', 'heading', 'speed', 'steer', 'pedal', 'status', 'progress', 'flags', 'reason'],
};

/** Field offsets inside one learner's stride. */
export const SNAP = { x: 0, y: 1, heading: 2, speed: 3, steer: 4, pedal: 5, status: 6, progress: 7, flags: 8, reason: 9 } as const;

/** Learner flag bits: what the lamps show and which rules it is breaking right now. */
export const LF_BRAKE = 1;
export const LF_LEFT = 2;
export const LF_RIGHT = 4;
export const LF_LANE = 8;
export const LF_WRONG_WAY = 16;
export const LF_SPEEDING = 32;
/** Latched: ran a red light at some point this episode. */
export const LF_RAN_RED = 64;
export const LF_WAITING = 128;
