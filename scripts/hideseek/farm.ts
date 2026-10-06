/**
 * Plays Hide and Seek matches on worker threads for the headless scripts.
 * Loaded on the main thread it only exports the Farm. Loaded inside a
 * worker (the Farm boots each worker with this same file) it serves jobs.
 */
import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { createArenaPool, runMatch, type ArenaPool, type MatchControllers, type MatchResult, type MatchSpec } from '../../src/engine/hideseek';
import { createScriptHost, type ScriptHostAdapter } from '../../src/engine/script';
import { scannerSeekerController } from './scannerSeeker';

/**
 * One match to play. `heldOut` swaps the seeker for the scanner seeker,
 * which no run ever trains against. `script` is SBL source whose
 * controllers drive both teams (scripted yardsticks in the spec still win).
 */
export interface Job {
  spec: MatchSpec;
  heldOut?: boolean;
  script?: string;
}

const hosts = new Map<string, ScriptHostAdapter>();

function controllersFor(job: Job): MatchControllers {
  const out: MatchControllers = {};
  if (job.script) {
    let host = hosts.get(job.script);
    if (!host) hosts.set(job.script, (host = createScriptHost(job.script)));
    Object.assign(out, host.createHideSeekControllers(job.spec.seed));
  }
  if (job.heldOut) out.seeker = scannerSeekerController;
  return out;
}

export function play(job: Job, pool: ArenaPool): MatchResult {
  return runMatch(job.spec, pool, controllersFor(job));
}

/** Worker side: plays each batch it is sent and posts the results back in the same order. */
async function serve(): Promise<void> {
  const pool = await createArenaPool();
  parentPort?.on('message', (jobs: Job[]) => parentPort?.postMessage(jobs.map((j) => play(j, pool))));
}

function call(worker: Worker, jobs: Job[]): Promise<MatchResult[]> {
  return new Promise((resolve, reject) => {
    const fail = (err: Error) => reject(err);
    worker.once('error', fail);
    worker.once('message', (out: MatchResult[]) => {
      worker.off('error', fail);
      resolve(out);
    });
    worker.postMessage(jobs);
  });
}

/**
 * Spreads matches over worker threads in small batches, handed out as
 * workers free up. Each worker loads this file through tsx, because a
 * plain worker cannot resolve the engine's TypeScript imports.
 */
export class Farm {
  private readonly workers: Worker[];
  private local: ArenaPool | null = null;

  constructor(count: number) {
    const boot = `require('tsx/cjs/api').require(${JSON.stringify(__filename)}, ${JSON.stringify(__filename)});`;
    this.workers = Array.from({ length: count }, () => new Worker(boot, { eval: true }));
  }

  async run(jobs: Job[]): Promise<MatchResult[]> {
    if (this.workers.length === 0) {
      this.local ??= await createArenaPool();
      const pool = this.local;
      return jobs.map((j) => play(j, pool));
    }
    const results: MatchResult[] = new Array(jobs.length);
    const batch = Math.max(1, Math.ceil(jobs.length / (this.workers.length * 4)));
    let next = 0;
    const drain = async (w: Worker) => {
      while (next < jobs.length) {
        const start = next;
        next += batch;
        (await call(w, jobs.slice(start, start + batch))).forEach((r, k) => (results[start + k] = r));
      }
    };
    await Promise.all(this.workers.map(drain));
    return results;
  }

  /** Plays a whole plan and gives the results back in its shape. */
  async runPlan(plan: MatchSpec[][], script?: string): Promise<MatchResult[][]> {
    const flat = await this.run(plan.flat().map((spec) => ({ spec, script })));
    let k = 0;
    return plan.map((round) => round.map(() => flat[k++]));
  }

  close(): void {
    for (const w of this.workers) void w.terminate();
    this.local?.dispose();
  }
}

if (!isMainThread) void serve();
