import { MAX_PEDS } from '../world/state';

/**
 * The people of the city, as flat arrays. Someone is always in one of four
 * modes: walking a sidewalk loop, waiting at a crossing, crossing on the
 * walk signal, or crossing mid block (rush hour only).
 */
export class Crowd {
  count = 0;
  /** Loop and arc length along it while walking; dir is +1 counterclockwise, -1 clockwise. */
  readonly ring = new Int32Array(MAX_PEDS);
  readonly s = new Float64Array(MAX_PEDS);
  readonly dir = new Int8Array(MAX_PEDS);
  /** Sideways offset from the walking line (left of the loop's direction), now and preferred. */
  readonly lat = new Float64Array(MAX_PEDS);
  readonly pref = new Float64Array(MAX_PEDS);
  readonly speed = new Float64Array(MAX_PEDS);
  readonly mode = new Uint8Array(MAX_PEDS);
  /** The crossing someone waits at or walks over, and which end they started from (0 for a, 1 for b). */
  readonly crossing = new Int32Array(MAX_PEDS);
  readonly end = new Uint8Array(MAX_PEDS);
  /** Where along the crossing band they walk, m from its middle, so a group does not stack up. */
  readonly spread = new Float64Array(MAX_PEDS);
  /** Goes on the flashing hand as well as the walking one. */
  readonly late = new Uint8Array(MAX_PEDS);
  /** Meters to walk before considering another crossing, so nobody turns straight back. */
  readonly cooldown = new Float64Array(MAX_PEDS);
  /** Target point while crossing or walking to a waiting spot, and the loop to join on arrival. */
  readonly tx = new Float64Array(MAX_PEDS);
  readonly ty = new Float64Array(MAX_PEDS);
  readonly toRing = new Int32Array(MAX_PEDS);
  readonly toS = new Float64Array(MAX_PEDS);
  readonly x = new Float64Array(MAX_PEDS);
  readonly y = new Float64Array(MAX_PEDS);
  readonly heading = new Float64Array(MAX_PEDS);
  readonly phase = new Float64Array(MAX_PEDS);
  readonly look = new Uint8Array(MAX_PEDS);
}

/** One full walk cycle (two steps) covers about this much ground, m. */
export const STRIDE = 1.45;
/** How far from the curb people stand while they wait to cross, m. */
export const CURB_GAP = 0.55;
