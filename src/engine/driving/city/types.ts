import type { Path } from '../geometry/path';
import type { Dir } from './dimensions';

/**
 * What a city is made from. Everything else (streets, lanes, turns,
 * signals, sidewalks, crossings) is derived from this and is the same on
 * every machine. It is small and plain, so runs can store it.
 */
export interface CitySpec {
  id: string;
  name: string;
  /** Width of each column of blocks, street centerline to centerline, m. */
  columns: number[];
  /** Depth of each row of blocks, m. */
  rows: number[];
  /** Seeds the decorative choices (building styles, trees) and the signal offsets. */
  seed: number;
  /** Street lines signed 30 km/h: vertical lines by x index, horizontal lines by y index. */
  slow?: { vertical: number[]; horizontal: number[] };
}

/** A street corner or crossing. Arms say which of the four directions have a street. */
export interface CityNode {
  id: number;
  /** Grid position: column line i, row line j. */
  i: number;
  j: number;
  x: number;
  y: number;
  arms: [boolean, boolean, boolean, boolean];
  armCount: number;
  /** Index into City.signals, or -1 for an unsignalized corner. */
  signal: number;
}

export const ELEMENT_LANE = 0;
export const ELEMENT_CONNECTOR = 1;

/** Where a connector crosses a zebra crossing, in its own arc length. */
export interface CrossingSpan {
  crosswalk: number;
  s0: number;
  s1: number;
}

/**
 * One drivable piece of the lane graph: a lane along a street between two
 * stop lines, or a connector that turns (or goes straight) through an
 * intersection. Traffic, routes and the learners all move along these.
 */
export interface RoadElement {
  id: number;
  kind: typeof ELEMENT_LANE | typeof ELEMENT_CONNECTOR;
  path: Path;
  /** Elements that may follow this one. */
  next: number[];
  /** Lanes: the node at each end. Connectors: from and to are both the node it crosses. */
  from: number;
  to: number;
  /** Direction of travel at the start and at the end. */
  dir: Dir;
  exitDir: Dir;
  /** Connectors: -1 left, 0 straight, 1 right. Lanes: 0. */
  turn: -1 | 0 | 1;
  speedLimit: number;
  /** Lanes: true when the lane ends at a signal's stop line. */
  stopLine: boolean;
  /** Lanes: the lane running the other way on the same street, or -1. */
  opposite: number;
  /** Connectors: the lane they come from and the lane they lead into. */
  fromLane: number;
  toLane: number;
  /** Connectors: the zebra crossings they pass over. */
  crossings: CrossingSpan[];
}

/** A zebra crossing across one arm of a signalized intersection. */
export interface Crosswalk {
  id: number;
  node: number;
  arm: Dir;
  /** Center of the crossing and its two ends on the sidewalks, where people wait. */
  x: number;
  y: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Which sidewalk loop each end belongs to, and where on it. */
  ringA: number;
  sA: number;
  ringB: number;
  sB: number;
  /** People cross this arm while traffic along the other axis has green: 0 when north south is green, 1 for east west. */
  walkAxis: 0 | 1;
}

/** A block of buildings between four street lines, inside its curbs. */
export interface CityBlock {
  i: number;
  j: number;
  /** Curb outline: x0..x1 by y0..y1, corners rounded by CURB_RADIUS. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface City {
  spec: CitySpec;
  /** Street centerlines: vertical streets at xs, horizontal streets at ys. */
  xs: Float64Array;
  ys: Float64Array;
  nodes: CityNode[];
  /** Lanes first, then connectors; ids index this array. */
  elements: RoadElement[];
  laneCount: number;
  /** Nodes with traffic signals, in signal index order. */
  signals: number[];
  /** Phase offset of each signal, s. */
  signalOffsets: Float64Array;
  blocks: CityBlock[];
  /** Sidewalk loops: one around each block, plus one around the whole city (the last). */
  rings: Path[];
  crosswalks: Crosswalk[];
  /** Curb to curb extent of the street grid: outside it is sidewalk and buildings. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}
