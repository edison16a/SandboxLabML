/**
 * Runs storage writes one after another, in the order they were asked for.
 * IndexedDB gives no ordering between transactions on different stores, so
 * without this a checkpoint could land on disk while the generations before
 * it were still waiting, and a closed tab would leave a hole in the history.
 * A failed write does not hold up the ones after it.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();

  push<T>(write: () => Promise<T>): Promise<T> {
    const run = this.tail.then(write);
    this.tail = run.catch(() => undefined);
    return run;
  }
}
