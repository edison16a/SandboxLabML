/**
 * The street cross section and the intersection layout, in meters. One
 * lane each way, right hand traffic. Distances along an arm are measured
 * from the intersection's center. The renderer draws every marking from
 * these same numbers, so the paint always matches what the cars obey.
 */
export const LANE_WIDTH = 3.5;
/** Centerline to curb. */
export const ROAD_HALF = LANE_WIDTH;
export const SIDEWALK = 3.5;
/** Centerline to the building line. */
export const PROPERTY = ROAD_HALF + SIDEWALK;
/** Radius of the rounded curb at each street corner. */
export const CURB_RADIUS = 4;
/** Zebra crossing band on each arm, from the center. */
export const CROSSWALK_NEAR = 8;
export const CROSSWALK_FAR = 11;
export const CROSSWALK_MID = (CROSSWALK_NEAR + CROSSWALK_FAR) / 2;
/** Stop line, where lanes end and turn connectors begin. */
export const STOP_LINE = 12;
/** Lane center offset from the street centerline. */
export const LANE_OFFSET = LANE_WIDTH / 2;
/** Where people walk: the middle of the sidewalk. */
export const WALK_LINE = ROAD_HALF + SIDEWALK / 2;
/** Turn radii through an intersection, chosen to hug the curb (right) and sweep wide (left). */
export const RIGHT_TURN_RADIUS = CURB_RADIUS + LANE_OFFSET;
export const LEFT_TURN_RADIUS = STOP_LINE + LANE_OFFSET;

/** Speed limits, m/s: 50 km/h in town, 30 km/h in slow zones. */
export const TOWN_LIMIT = 13.9;
export const SLOW_LIMIT = 8.3;

/** Directions of travel or arms of an intersection: east, north, west, south. Heading = dir * pi / 2. */
export type Dir = 0 | 1 | 2 | 3;
export const DIR_X = [1, 0, -1, 0] as const;
export const DIR_Y = [0, 1, 0, -1] as const;

export function opposite(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}

/** Turn from one travel direction to another: -1 left, 0 straight, 1 right, 2 a U turn. */
export function turnBetween(from: Dir, to: Dir): -1 | 0 | 1 | 2 {
  const d = (to - from + 4) % 4;
  return d === 0 ? 0 : d === 1 ? -1 : d === 3 ? 1 : 2;
}
