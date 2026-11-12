import type { Look } from '../looks';
import type { Pt } from '../body/section';

/** A profile along the car as [x, value] keys in meters, nose at +length/2. */
export type Keys = ReadonlyArray<readonly [number, number]>;

/**
 * How one end of the car rounds off. In plan the body narrows over the
 * last `reach` meters like a superellipse: `square` 2 is a half circle,
 * higher is boxier with tighter corners. The end face also tucks back
 * above and below the height `leanAt`, by `lean` meters at 0.35 m away,
 * so a bumper reads as the most forward line instead of a flat wall.
 */
export interface PlanEnd {
  reach: number;
  square: number;
  lean: number;
  leanAt: number;
}

/**
 * Which way a decal is laid onto the body: from the side in (x, y), from
 * above in (x, z), or from the front or back in (z, y). Each decal is drawn
 * on the half at z of 0 and up, which is the car's right side (the world
 * maps local +z to the driver's right), and mirrored onto the left.
 */
export type View = 'side' | 'top' | 'front' | 'rear';

/**
 * A patch of the body surface bounded by four curves in a view's plane:
 * `bottom` and `top` run the same way, `left` and `right` join their
 * starts and ends (straight lines when left out). A curve of one point
 * makes a pointed end.
 */
export interface Region {
  view: View;
  bottom: Pt[];
  top: Pt[];
  left?: Pt[];
  right?: Pt[];
}

/**
 * A piece put on the body: glass, a lamp, a grille, a plate, a line.
 * - `stamp` (the default) paints it flush into the shell (body/imprint.ts);
 *   later stamps win. Right for glass and anything that wraps a corner.
 * - `float` lays it as its own thin sheet just proud of the paint: cheaper
 *   for small or thin pieces on gently curved paint.
 * - `ring` lays a thin frame from the outline out to `grow` meters beyond
 *   it, the dark surround round a window.
 * `cells` sets how finely it is drawn on High, along and across. `fine`
 * pieces are dropped on Low.
 */
export interface Decal {
  region: Region;
  look: Look;
  kind?: 'stamp' | 'float' | 'ring';
  lamp?: number;
  grow?: number;
  cells: [number, number];
  fine?: boolean;
}

/**
 * One traffic body type: its footprint (the simulation's), wheels, the
 * plan of its ends, side view profiles of the section keys from the sill
 * up to the roof, and the decals laid on top. Sections at any x come from
 * these profiles (see body/frame.ts), so a type is pure data.
 */
export interface CarShape {
  kind: number;
  length: number;
  width: number;
  wheelbase: number;
  wheelRadius: number;
  /** How far both axles sit forward of the body's middle, m. */
  axleShift: number;
  /** Wheel center distance from the centerline, m. */
  track: number;
  nose: PlanEnd;
  tail: PlanEnd;
  /** Heights of the section keys: sill bottom, top of the black lower trim, widest point, shoulder crease, belt. */
  sill: Keys;
  trim: Keys;
  waist: Keys;
  shoulder: Keys;
  belt: Keys;
  /** Height of the centerline: hood, glass, roof and deck. */
  top: Keys;
  /** How far the roof rail's top edge sits below the centerline (the crown), and the rail's corner below that. */
  crown: Keys;
  corner: Keys;
  /** Insets from the full half width of the belt, the rail's side and the rail's top. */
  beltIn: Keys;
  sideIn: Keys;
  topIn: Keys;
  decals: Decal[];
  /** Door mirror: its center along x and up y, and how far it reaches out past the belt, m. */
  mirror: { x: number; y: number; out: number };
  /** A lit sign on the roof, for the cab. */
  roofSign: boolean;
}
