import type { SnapshotLayout } from '../env/types';

/**
 * 8 floats per agent, shared by the population stream and champion replays.
 * Status is NAV_RUNNING, NAV_FINISHED, NAV_DIED or NAV_STOPPED; flags are
 * the FLAG_* bits; progress is the share of the walking distance covered
 * now; stopTime is when the run ended (s, 0 while running), so a renderer
 * can time a fall or a celebration from the world clock at any speed.
 */
export const NAVIGATION_SNAPSHOT: SnapshotLayout = {
  stride: 8,
  fields: ['x', 'z', 'yaw', 'speed', 'status', 'progress', 'flags', 'stopTime'],
};

export const SNAP_X = 0;
export const SNAP_Z = 1;
export const SNAP_YAW = 2;
export const SNAP_SPEED = 3;
export const SNAP_STATUS = 4;
export const SNAP_PROGRESS = 5;
export const SNAP_FLAGS = 6;
export const SNAP_STOP_TIME = 7;

/**
 * The world block, for state that is not per agent: the episode clock and
 * where each mover stands. Laid out as [time, moverCount, x0, z0, x1, z1,
 * ...]. Movers are a pure function of the clock, but streaming their
 * positions keeps renderers free of course logic.
 */
export const WORLD_TIME = 0;
export const WORLD_MOVER_COUNT = 1;
export const WORLD_HEADER = 2;
/** Most movers a course may hold, so a world buffer can be sized once. */
export const MAX_MOVERS = 12;

/** Floats in a world block for `movers` movers. */
export function navigationWorldSize(movers = MAX_MOVERS): number {
  return WORLD_HEADER + movers * 2;
}
