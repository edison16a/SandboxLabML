import type { Track } from '../track/types';

/** Distance along the road from one grid slot to the next, m. Cars alternate sides, so a side's slots are twice this apart. */
export const GRID_SPACING = 6;

/** Share of the half width a grid car sits off the centerline. Keeps it well inside the white lines on the narrowest road. */
const LANE_OFFSET = 0.42;

/** Where a car lines up before the start. */
export interface GridSlot {
  /** Centerline sample the car sits beside. */
  index: number;
  /** Meters behind the start line, measured along the centerline. */
  back: number;
  /** Signed offset from the centerline, positive to the left. */
  lateral: number;
}

/**
 * Slot 0 is the start line on the centerline, exactly where training puts
 * every car, so a lone champion still replays its lap to the tick. Later
 * slots alternate left and right and step back along the road, like a
 * staggered race grid, so several copies of one champion never sit on top
 * of each other. Slots follow the road, so a grid behind a bend bends too.
 */
export function gridSlot(track: Track, slot: number): GridSlot {
  if (slot <= 0) return { index: 0, back: 0, lateral: 0 };
  // Never wrap all the way round: the last slot stays at least one sample behind the line.
  const steps = Math.min(Math.round((slot * GRID_SPACING) / track.spacing), track.count - 1);
  const index = track.count - steps;
  return {
    index,
    back: track.length - track.s[index],
    lateral: (slot % 2 === 1 ? 1 : -1) * track.halfWidth * LANE_OFFSET,
  };
}

/** World position and heading of a slot. The left normal of the road is (-ty, tx). */
export function slotPose(track: Track, slot: GridSlot): { x: number; y: number; heading: number } {
  const i = slot.index;
  return {
    x: track.cx[i] - track.ty[i] * slot.lateral,
    y: track.cy[i] + track.tx[i] * slot.lateral,
    heading: Math.atan2(track.ty[i], track.tx[i]),
  };
}
