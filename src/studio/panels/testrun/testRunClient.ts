import * as Comlink from 'comlink';
import type { MatchTestRequest, MatchTestResult } from './hideseek/types';
import type { TestRunApi } from './testRun.worker';
import type { TestRunRequest, TestRunResult } from './types';

/** Starts a test worker. Each caller owns its worker and terminates it when done. */
export function startTestWorker(name: string): { worker: Worker; api: Comlink.Remote<TestRunApi> } {
  const worker = new Worker(new URL('./testRun.worker.ts', import.meta.url), { type: 'module', name });
  return { worker, api: Comlink.wrap<TestRunApi>(worker) };
}

/** Runs one call in a fresh worker. Aborting terminates the worker, which stops even a script stuck in a long loop. */
function inFreshWorker<T>(signal: AbortSignal, call: (api: Comlink.Remote<TestRunApi>) => Promise<T>): Promise<T> {
  const { worker, api } = startTestWorker('studio-test-run');
  return new Promise<T>((resolve, reject) => {
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
    call(api)
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener('abort', stop);
        worker.terminate();
      });
  });
}

/** Runs one racing test episode in a fresh worker. */
export function runInWorker(req: TestRunRequest, signal: AbortSignal): Promise<TestRunResult> {
  return inFreshWorker<TestRunResult>(signal, async (api) => api.run(req));
}

/** Plays one Hide and Seek test match in a fresh worker. */
export function runMatchInWorker(req: MatchTestRequest, signal: AbortSignal): Promise<MatchTestResult> {
  return inFreshWorker<MatchTestResult>(signal, async (api) => api.match(req));
}
