import { markDone } from './doneMarker';
import { actedOnEntry, backIndex, isLast, nextIndex, stepAt } from './flow';
import type { Tour } from './types';
import { closeWalkthrough, showStep, useWalkthrough } from './walkStore';

/**
 * Moves to a step: sets the page up for it, notes whether its action is
 * already done, and remembers the tour as seen once the last step opens,
 * since that step's links lead away from the lab.
 */
export function goTo(tour: Tour, index: number): void {
  const step = stepAt(tour, index);
  step?.prepare?.();
  showStep(index, actedOnEntry(step));
  if (isLast(tour, index)) markDone(tour.storageKey);
}

export function goNext(tour: Tour): void {
  const next = nextIndex(tour, useWalkthrough.getState().index);
  if (next === null) finishTour(tour);
  else goTo(tour, next);
}

export function goBack(tour: Tour): void {
  goTo(tour, backIndex(useWalkthrough.getState().index));
}

/** Ends the tour, skipped or finished, and keeps it from starting by itself again. */
export function finishTour(tour: Tour): void {
  markDone(tour.storageKey);
  closeWalkthrough();
}
