/**
 * Which runs just left the active list: moved to Trash, deleted for good,
 * or wiped with everything else ('all'). A lab session that still trains
 * one of them hears it here and stops, instead of training a run the user
 * threw away. Only this tab hears it; the writes themselves skip a run
 * whose row is gone, so another tab can never leave orphan rows either.
 */
export type RemovedRuns = readonly string[] | 'all';

type Listener = (removed: RemovedRuns) => void;

const listeners = new Set<Listener>();

/** Calls `listener` whenever runs are trashed, destroyed or wiped. Returns the unsubscribe. */
export function onRunsRemoved(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Tells every listener these runs are gone from the active list. */
export function runsRemoved(removed: RemovedRuns): void {
  for (const listener of listeners) listener(removed);
}

/** True when `runId` is among the removed runs. */
export function isRemoved(removed: RemovedRuns, runId: string): boolean {
  return removed === 'all' || removed.includes(runId);
}
