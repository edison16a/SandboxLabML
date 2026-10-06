import * as Comlink from 'comlink';
import type { MatchTestRequest, MatchTestResult } from './hideseek/types';
import type { TestRunApi } from './testRun.worker';
import type { TestRunRequest, TestRunResult } from './types';

/** Starts a test worker. Each caller owns its worker and terminates it when done. */
export function startTestWorker(name: string): { worker: Worker; api: Comlink.Remote<TestRunApi> } {
  const worker = new Worker(new URL('./testRun.worker.ts', import.meta.url), { type: 'module', name });
  return { worker, api: Comlink.wrap<TestRunApi>(worker) };
}

type TestWorker = ReturnType<typeof startTestWorker>;

/**
 * The last worker that finished cleanly, kept for the next run. A Hide and
 * Seek match first loads the physics engine and warms up the JIT, which
 * takes about a second; a warm worker skips both and also times ticks more
 * steadily. A worker that was cancelled or failed is never reused.
 */
let warm: TestWorker | null = null;

/** Runs one call in the warm worker or a new one. Aborting terminates the worker, which stops even a script stuck in a long loop. */
function inWorker<T>(signal: AbortSignal, call: (api: Comlink.Remote<TestRunApi>) => Promise<T>): Promise<T> {
  const w = warm ?? startTestWorker('studio-test-run');
  warm = null;
  return new Promise<T>((resolve, reject) => {
    const drop = () => w.worker.terminate();
    const stop = () => {
      drop();
      reject(new DOMException('The test run was cancelled.', 'AbortError'));
    };
    const failed = (e: ErrorEvent) => {
      drop();
      reject(new Error(e.message || 'The test worker failed to start.'));
    };
    if (signal.aborted) return stop();
    signal.addEventListener('abort', stop, { once: true });
    w.worker.addEventListener('error', failed);
    call(w.api)
      .then(
        (value) => {
          // Keep it for next time unless another finished worker got there first.
          if (warm) drop();
          else warm = w;
          resolve(value);
        },
        (err) => {
          drop();
          reject(err);
        },
      )
      .finally(() => {
        signal.removeEventListener('abort', stop);
        w.worker.removeEventListener('error', failed);
      });
  });
}

/** Runs one racing test episode in a test worker. */
export function runInWorker(req: TestRunRequest, signal: AbortSignal): Promise<TestRunResult> {
  return inWorker<TestRunResult>(signal, async (api) => api.run(req));
}

/** Plays one Hide and Seek test match in a test worker. */
export function runMatchInWorker(req: MatchTestRequest, signal: AbortSignal): Promise<MatchTestResult> {
  return inWorker<MatchTestResult>(signal, async (api) => api.match(req));
}
