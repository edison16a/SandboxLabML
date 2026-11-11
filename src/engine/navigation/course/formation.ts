import { mixSeed, Rng } from '../../core/rng';
import type { NavigationParams } from '../params';
import { START_ZONE } from './types';

/** Gap from a side wall to the outermost spot's center, m: an agent's radius and a little air. */
const SIDE_GAP = 0.6;
/** The front row stands this far behind the start line, m, so nobody's body is over it. */
const FRONT_GAP = 0.5;
/** The back row keeps this far from the back wall, m. */
const BACK_GAP = 0.7;

/**
 * The start grid of a course: rows across the room behind the start line,
 * like the start of a race. Even rows hold `columns` spots, odd rows one
 * fewer, set half a gap across, so neighbours in two rows never stand
 * right behind each other. Spots fill from the front row's middle outward,
 * then row by row, so any number of agents makes a tidy block.
 */
export interface StartFormation {
  /** Center x of the front row, m. */
  frontX: number;
  rowGap: number;
  /** Gap between spots in a row, m, stretched so the outermost spots sit SIDE_GAP from the walls. */
  spacing: number;
  /** Spots in an even row. */
  columns: number;
  /** Rows that fit between the start line and the back wall. */
  rows: number;
  /** Spots in those rows. Slots past it stand in the gaps of the grid (see formationSpot). */
  capacity: number;
}

/** The start grid for a room of `width` whose start line is at `startLine`. */
export function startFormation(startLine: number, width: number, length: number, params: NavigationParams): StartFormation {
  const s = params.start;
  const span = Math.max(0, width - 2 * SIDE_GAP);
  const columns = Math.max(1, Math.floor(span / s.spacing + 1e-9) + 1);
  const spacing = columns > 1 ? span / (columns - 1) : 0;
  const frontX = startLine - FRONT_GAP;
  const depth = frontX - (-length / 2 + BACK_GAP);
  const rows = Math.max(1, Math.floor(depth / s.rowGap + 1e-9) + 1);
  const pairs = Math.floor(rows / 2);
  const capacity = pairs * (2 * columns - 1) + (rows % 2 === 1 ? columns : 0);
  return { frontX, rowGap: s.rowGap, spacing, columns, rows, capacity };
}

/**
 * Where the k-th spot of a row of `n` stands across the room, as a count
 * of gaps from the middle: 0, +1, -1, +2, ... for an odd row, and +-0.5,
 * +-1.5, ... for an even one, so a row fills from its middle outward.
 */
export function spotOffset(k: number, n: number): number {
  if (n % 2 === 1) return k === 0 ? 0 : k % 2 === 1 ? (k + 1) / 2 : -k / 2;
  const m = Math.floor(k / 2);
  return k % 2 === 0 ? -(m + 0.5) : m + 0.5;
}

/**
 * The spot of start slot `slot`, written into `out`. It depends only on the
 * course and the slot, never on how many agents start, so an agent replayed
 * alone stands exactly where it stood in its generation. Slots past the
 * grid's capacity stand in the gaps between its spots, a layer at a time.
 */
export function formationSpot(f: StartFormation, slot: number, out: { x: number; z: number }): void {
  const layer = Math.floor(slot / f.capacity);
  let k = slot - layer * f.capacity;
  let row = 0;
  for (; row < f.rows; row++) {
    const n = row % 2 === 0 ? f.columns : f.columns - 1;
    if (k < n) break;
    k -= n;
  }
  const n = row % 2 === 0 ? f.columns : f.columns - 1;
  out.x = f.frontX - row * f.rowGap;
  out.z = spotOffset(k, n) * f.spacing;
  if (layer > 0) {
    // Into the gap half a row back and half a spot across, toward the middle so it stays off the walls.
    out.x -= f.rowGap / 2;
    out.z += (out.z > 0 ? -0.5 : 0.5) * f.spacing * (layer % 2 === 1 ? 1 : -1);
  }
}

/** The slot an agent takes when none is given: one spot of the grid, from its seed. Agents may share one, so a lab should hand out slots (see formationSlots). */
export function seedSlot(seed: number, f: StartFormation): number {
  return new Rng(mixSeed(seed, 0x510f)).int(f.capacity);
}

/**
 * Start slots 0 to count - 1 in a seeded order, one per agent. A lab hands
 * these out each generation (seeded by the run and the generation), so
 * nobody keeps the front row, and stores the champion's slot so its replay
 * starts on the same spot.
 */
export function formationSlots(count: number, seed: number): number[] {
  const slots = Array.from({ length: count }, (_, i) => i);
  const rng = new Rng(mixSeed(seed, 0x5107));
  for (let i = count - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
}

/** x of the start line for a room of `length`. */
export function startLineX(length: number): number {
  return -length / 2 + START_ZONE;
}
