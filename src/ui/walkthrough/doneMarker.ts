import { DONE_MARK } from './flow';

/** What the storage key holds, or null when it is empty or storage is blocked. */
export function readMarker(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Remembers that the tour was finished or skipped, so it does not start by itself again. */
export function markDone(key: string): void {
  try {
    window.localStorage.setItem(key, DONE_MARK);
  } catch {
    // Private mode or blocked storage: the tour just offers itself again next time.
  }
}
