import type { BoxSize, HideSeekPhysics } from './physics';

/** What a box is. Cubes and planks are crates; a ramp is a wedge agents can run up (see HideSeekPhysics.box.ramp). */
export type BoxKind = 'cube' | 'plank' | 'ramp';

/** The kinds of a 1 v 1 arena's boxes, in index order: two cubes, two planks, then a ramp. */
export const BOX_KINDS: readonly BoxKind[] = ['cube', 'cube', 'plank', 'plank', 'ramp'];
export const BOX_COUNT = BOX_KINDS.length;

/** Size of box `index` of a 1 v 1 match, whose kinds follow BOX_KINDS. */
export function boxSize(p: HideSeekPhysics, index: number): BoxSize {
  return boxKindSize(p, BOX_KINDS[index]);
}

/** Size of a box by kind. The Sandbox places any mix of kinds, so its boxes carry their kind. */
export function boxKindSize(p: HideSeekPhysics, kind: BoxKind): BoxSize {
  return kind === 'cube' ? p.box.cube : kind === 'plank' ? p.box.plank : p.box.ramp;
}

/** Height of a ramp's top `progress` m up the slope from its foot, measured on the floor plane. */
export function rampHeightAt(p: HideSeekPhysics, progress: number): number {
  const r = p.box.ramp;
  return (r.height * Math.max(0, Math.min(r.length, progress))) / r.length;
}

/**
 * The part of a box that stands taller than the sight height, as a
 * rectangle in the box frame: its center sits `offset` m along local x
 * from the box center, with half sizes `hx` and `hz`. Sight lines and
 * sensor rays run at that height, so this rectangle is exactly what they
 * hit. Crates are whole; for a ramp it is the high end of the wedge, a
 * shorter rectangle shifted toward the lip.
 */
export interface BoxSlice {
  offset: number;
  hx: number;
  hz: number;
}

/** The sight slice of a box kind (see BoxSlice). Zero sized when the box is lower than the sight height. */
export function boxSlice(p: HideSeekPhysics, kind: BoxKind): BoxSlice {
  const s = boxKindSize(p, kind);
  if (s.height <= p.rayHeight) return { offset: 0, hx: 0, hz: 0 };
  if (kind !== 'ramp') return { offset: 0, hx: s.length / 2, hz: s.width / 2 };
  // The slope reaches the sight height this far from the foot.
  const start = (s.length * p.rayHeight) / s.height;
  return { offset: start / 2, hx: (s.length - start) / 2, hz: s.width / 2 };
}
