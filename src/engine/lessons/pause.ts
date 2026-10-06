/**
 * Lets the event loop run. Checks train and play on the thread that asked
 * for them, so they pause between slices of work to keep a browser tab
 * responsive and to notice a cancel. Works the same in a tab, a worker and Node.
 */
export function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
