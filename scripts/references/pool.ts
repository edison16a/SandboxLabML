/**
 * Worker threads for the reference generator. Loaded on the main thread it
 * only exports the pool. Loaded inside a worker (the pool boots each one
 * with this same file) it serves jobs of either environment.
 */
import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { runJob, type Job, type JobResult } from './jobs';

/** Worker side: runs each job it is sent and posts the result back. */
function serve(): void {
  parentPort?.on('message', (job: Job) => {
    void runJob(job).then((result) => parentPort?.postMessage(result));
  });
}

function call(worker: Worker, job: Job): Promise<JobResult> {
  return new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('message', (result: JobResult) => {
      worker.off('error', reject);
      resolve(result);
    });
    worker.postMessage(job);
  });
}

/**
 * Hands jobs to worker threads as they free up, longest first when the
 * caller sorts them that way. Each worker loads this file through tsx,
 * because a plain worker cannot resolve the engine's TypeScript imports.
 * With no workers, jobs run one by one on this thread.
 */
export class JobPool {
  private readonly workers: Worker[];

  constructor(count: number) {
    const boot = `require('tsx/cjs/api').require(${JSON.stringify(__filename)}, ${JSON.stringify(__filename)});`;
    this.workers = Array.from({ length: count }, () => new Worker(boot, { eval: true }));
  }

  /** Runs every job and returns the results in job order. `onDone` sees each result as it lands. */
  async run<R extends JobResult>(jobs: Job[], onDone: (r: R) => void = () => {}): Promise<R[]> {
    const out: R[] = new Array(jobs.length);
    if (this.workers.length === 0) {
      for (const [i, job] of jobs.entries()) onDone((out[i] = (await runJob(job)) as R));
      return out;
    }
    let next = 0;
    const drain = async (w: Worker) => {
      while (next < jobs.length) {
        const i = next++;
        onDone((out[i] = (await call(w, jobs[i])) as R));
      }
    };
    await Promise.all(this.workers.map(drain));
    return out;
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}

if (!isMainThread) serve();
