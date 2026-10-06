import type { PreviewResult } from '@/engine/lessons/preview/types';
import { startTestWorker } from '../../testrun/testRunClient';

/** The running worker, and the reject of the request it is working on while there is one. */
type Live = ReturnType<typeof startTestWorker> & { reject: ((err: Error) => void) | null };

/**
 * The lesson preview's worker. It stays up while the preview is open, so
 * Rapier loads once and later matches start at once. A new request while
 * one is still running terminates the worker and starts a fresh one: the
 * old result is no longer wanted, and a script stuck in a long loop must
 * not hold the preview up.
 */
export class PreviewRunner {
  private live: Live | null = null;

  run(source: string): Promise<PreviewResult> {
    if (this.live?.reject) this.stop();
    const live: Live = (this.live ??= { ...startTestWorker('lesson-preview'), reject: null });
    return new Promise<PreviewResult>((resolve, reject) => {
      live.reject = reject;
      const fail = (e: ErrorEvent) => {
        live.reject = null;
        if (this.live === live) this.stop();
        reject(new Error(e.message || 'The preview worker failed to start.'));
      };
      live.worker.addEventListener('error', fail, { once: true });
      const settle = () => {
        live.reject = null;
        live.worker.removeEventListener('error', fail);
      };
      live.api.preview(source).then(
        (r) => {
          settle();
          resolve(r);
        },
        (err: unknown) => {
          settle();
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }

  /** Terminates the worker. A request still running is rejected with an AbortError. */
  stop(): void {
    const live = this.live;
    this.live = null;
    if (!live) return;
    live.worker.terminate();
    live.reject?.(new DOMException('The preview was replaced.', 'AbortError'));
    live.reject = null;
  }
}
