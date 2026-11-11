import type { SnapshotLayout } from '../env/types';

/** 8 floats per car. Shared by the population stream and the ghost stream. */
export const RACING_SNAPSHOT: SnapshotLayout = {
  stride: 8,
  fields: ['x', 'y', 'heading', 'speed', 'steer', 'pedal', 'status', 'progress'],
};
