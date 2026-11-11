/**
 * Course data. A course is a rectangular room on the floor: x runs from the
 * start line to the finish line, z across the width, both in meters with the
 * room's center at the origin. Agents face +x at the start, and heading 0
 * points along +x (forward is (cos yaw, -sin yaw), as in Hide and Seek).
 *
 * Specs are plain JSON, so a worker can rebuild exactly the same course
 * from a setup message, and a run can store the courses it trained on.
 */

/** Axis aligned rectangle on the floor: center and half sizes, m. */
export interface Rect {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

/** A static crate standing in the way. Its height is only for the renderer. */
export interface BlockSpec extends Rect {
  kind: 'block';
  height: number;
}

/** A wall segment. Walls with gaps are several segments in a row. */
export interface WallSpec extends Rect {
  kind: 'wall';
}

/** A spike pad on the floor. It blocks nothing, but touching it ends the run. */
export interface SpikesSpec extends Rect {
  kind: 'spikes';
}

/**
 * A crate that slides between two points, easing in and out at each end
 * like a piston: at time t its center is a + (b - a) * (1 - cos(2 pi (t /
 * period + phase))) / 2. It pushes agents, and one squeezed against a solid
 * is crushed.
 */
export interface MoverSpec {
  kind: 'mover';
  hx: number;
  hz: number;
  height: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Seconds for a full trip there and back. */
  period: number;
  /** Where in its trip it starts, 0 to 1. */
  phase: number;
}

export type ObstacleSpec = BlockSpec | WallSpec | SpikesSpec | MoverSpec;
export type ObstacleKind = ObstacleSpec['kind'];

export interface CourseSpec {
  /** Stable id: a preset name, or "level-<n>-<seed>" for a generated course. */
  id: string;
  name: string;
  /** The curriculum level it was made for, 0 to 6. */
  level: number;
  /** Inner size of the room, m: length along x, width along z. */
  length: number;
  width: number;
  obstacles: ObstacleSpec[];
}

/**
 * Depth of the start zone, m: from the start wall to the start line. Agents
 * line up on a grid of rows behind the line (see formation.ts); this fits
 * 8 rows, 132 agents in a 14 m room, and more stand in the grid's gaps.
 */
export const START_ZONE = 6.4;
/** Gap kept between the finish line and the end wall, m: room for finishers to run through and celebrate. */
export const FINISH_INSET = 3;
/** Thickness of the outer walls, m. */
export const OUTER_WALL = 0.4;
/** Thickness of inner walls, m. */
export const INNER_WALL = 0.3;
/** Height of the walls, m: low enough to see agents over them, for the renderer and the follow camera. */
export const WALL_HEIGHT = 1.4;
/** Longest and widest course any level makes, m. Inputs scale distances by these. */
export const MAX_COURSE_LENGTH = 50;
export const MAX_COURSE_WIDTH = 16;
/** Most movers a course runs, so a world buffer can be sized once. buildCourse keeps the first this many. */
export const MAX_MOVERS = 12;
