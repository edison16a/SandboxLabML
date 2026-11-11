/**
 * What a navigator remembers between ticks, one per agent, so a choice
 * holds instead of flickering: the crossing direction it took into a mover
 * zone, and the lane it is lining up at while it waits.
 */
export interface NavigatorMemory {
  /** Episode time of the last tick, s. Time running backwards means a new episode, and the memory clears. */
  time: number;
  /** The mover zone it set off across, or -1, the lane it took and the direction it crosses in. */
  zone: number;
  lane: number;
  cx: number;
  cz: number;
  /** The mover it is waiting for, the lane (an index into the planner's lanes) it lines up at, and ticks until it may pick again. */
  stageMover: number;
  stageLane: number;
  nextPick: number;
}

export function createMemory(): NavigatorMemory {
  return { time: -1, zone: -1, lane: -1, cx: 1, cz: 0, stageMover: -1, stageLane: 0, nextPick: 0 };
}
