import type { HsCamera } from '@/features/hideseek/state/types';
import { HS_CAMERAS } from '@/features/hideseek/state/types';
import type { Lattice } from '../layout/gridLattice';
import { arenaShot, closeShot, overviewShot, type Shot } from './framing';

/** Agent slot a first person view looks through (0 hider, 1 seeker), or -1. */
export function firstPersonAgent(c: HsCamera): number {
  return c === 'seeker' ? 1 : c === 'hider' ? 0 : -1;
}

/** Agent slot a follow view keeps in frame, or -1. */
export function followedAgentOf(c: HsCamera): number {
  return c === 'follow-seeker' ? 1 : c === 'follow-hider' ? 0 : -1;
}

/**
 * The follow shot: a drone a few meters off the agent's shoulder, high
 * enough to see over a wall, aimed at its chest. Stiffness (1/s) sets how
 * closely the aim trails a running agent: soft enough to feel like a
 * camera operator, firm enough that a sprint never leaves the frame.
 */
export const FOLLOW = { distance: 8.5, elevation: (38 * Math.PI) / 180, height: 0.7, stiffness: 5 };

/**
 * A number that changes whenever a set shot must be framed again: the view,
 * the focused arena and the grid's size and columns. A number, not a
 * string, because the rig checks it every frame.
 */
export function shotKey(c: HsCamera, focusSlot: number, count: number, cols: number): number {
  return HS_CAMERAS.indexOf(c) * 1e8 + (focusSlot + 1) * 1e5 + count * 1e3 + cols;
}

/**
 * The set shot for a view: the focused arena close up, square on or from
 * above, or the whole grid when no arena is focused. Follow views fall
 * back to the close shot while there is nobody to follow.
 */
export function presetShot(c: HsCamera, focus: { x: number; z: number } | null, lattice: Lattice, span: number, fov: number, aspect: number): Shot {
  const top = c === 'top';
  if (!focus) return overviewShot(lattice, fov, aspect, top, c !== 'overview' && !top);
  if (top || c === 'overview') return arenaShot(focus.x, focus.z, span, fov, aspect, top);
  return closeShot(focus.x, focus.z, span, fov, aspect);
}
