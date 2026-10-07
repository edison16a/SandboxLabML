import type { Pose } from '../frame';

export type HideSeekLayoutId = 'open' | 'shelter' | 'corridor';

/** An interior wall along x or along z, given by its end points in meters. */
export interface WallSegment {
  from: [number, number];
  to: [number, number];
}

/** Axis-aligned rectangle on the floor: center and half sizes, m. */
export interface Rect {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

/** Axis-aligned spawn area on the floor, m. */
export interface Region {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * One room. The outer walls come from the physics config; a layout adds
 * interior walls, where the five boxes start and where each team spawns.
 */
export interface ArenaLayout {
  id: HideSeekLayoutId;
  name: string;
  description: string;
  walls: WallSegment[];
  /** One spot per box, in BOX_KINDS order: cubes 0 and 1, planks 2 and 3, and the ramp 4 (yaw points uphill). */
  boxes: [Pose, Pose, Pose, Pose, Pose];
  hiderSpawn: Region;
  seekerSpawn: Region;
}
