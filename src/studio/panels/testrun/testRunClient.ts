import * as Comlink from 'comlink';
import type { TestRunApi } from './testRun.worker';
import type { TestRunRequest, TestRunResult } from './types';

/** Runs one test episode in a fresh worker. Aborting terminates the worker, which stops even a script stuck in a long loop. */
export function runInWorker(req: TestRunRequest, signal: AbortSignal): Promise<TestRunResult> {
  const worker = new Worker(new URL('./testRun.worker.ts', import.meta.url), { type: 'module', name: 'studio-test-run' });
  const api = Comlink.wrap<TestRunApi>(worker);
  return new Promise<TestRunResult>((resolve, reject) => {
    const stop = () => {
      worker.terminate();
      reject(new DOMException('The test run was cancelled.', 'AbortError'));
    };
    if (signal.aborted) return stop();
    signal.addEventListener('abort', stop, { once: true });
    worker.addEventListener('error', (e) => {
      worker.terminate();
      reject(new Error(e.message || 'The test worker failed to start.'));
    });
    api
      .run(req)
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener('abort', stop);
        worker.terminate();
      });
  });
}
