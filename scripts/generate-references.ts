/**
 * Regenerates public/references/racing.json, the reference curves the
 * Bench tab draws next to a user's score. For each Racing preset tier it
 * trains several seeds with a population of 100 and benchmarks the
 * champion every few generations, then keeps the median and the middle
 * half of the scores at each checkpoint.
 *
 *   npx tsx scripts/generate-references.ts --seeds 12 --generations 100 --workers 2
 *
 * Options, all optional: --seeds 12, --first-seed 1, --generations 100, --every 5,
 * --population 100, --workers 2 (0 runs everything on this thread),
 * --tiers beginner,intermediate,advanced (a subset is for experiments),
 * --out public/references/racing.json, --raw file.json (every seed's
 * scores, for tuning). Run it from the repo root.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { parseReferences, summarizeCurve } from '../src/engine/bench/references';
import type { BenchReferences, ReferenceCurve } from '../src/engine/bench/types';
import { BENCHMARK_VERSION, ENGINE_VERSION } from '../src/engine/core/version';
import { checkpoints, runReference, type ReferenceJob, type ReferenceRunResult } from './references/train';

const TIERS: ReferenceCurve['tier'][] = ['beginner', 'intermediate', 'advanced'];

/** Worker side: runs each job it is sent and posts the result back. */
function serve(): void {
  parentPort?.on('message', (job: ReferenceJob) => {
    void runReference(job).then((result) => parentPort?.postMessage(result));
  });
}

function call(worker: Worker, job: ReferenceJob): Promise<ReferenceRunResult> {
  return new Promise((resolve, reject) => {
    worker.once('error', reject);
    worker.once('message', (result: ReferenceRunResult) => {
      worker.off('error', reject);
      resolve(result);
    });
    worker.postMessage(job);
  });
}

/**
 * Hands jobs to worker threads as they free up. Each worker loads this
 * same file through tsx, because a plain worker cannot resolve the
 * engine's TypeScript imports.
 */
async function runAll(jobs: ReferenceJob[], workers: number, onDone: (r: ReferenceRunResult) => void): Promise<ReferenceRunResult[]> {
  if (workers === 0) {
    const out: ReferenceRunResult[] = [];
    for (const job of jobs) out.push(await runReference(job));
    out.forEach(onDone);
    return out;
  }
  const boot = `require('tsx/cjs/api').require(${JSON.stringify(__filename)}, ${JSON.stringify(__filename)});`;
  const pool = Array.from({ length: workers }, () => new Worker(boot, { eval: true }));
  const out: ReferenceRunResult[] = [];
  let next = 0;
  const drain = async (w: Worker) => {
    while (next < jobs.length) {
      const result = await call(w, jobs[next++]);
      onDone(result);
      out.push(result);
    }
  };
  try {
    await Promise.all(pool.map(drain));
  } finally {
    await Promise.all(pool.map((w) => w.terminate()));
  }
  return out;
}

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  return out;
}

/**
 * Keeps the old generatedAt when nothing else changed. Training is
 * deterministic, so a nightly rerun on an unchanged engine writes the same
 * file and the workflow has nothing to commit.
 */
function stableDate(path: string, next: BenchReferences): BenchReferences {
  if (!existsSync(path)) return next;
  const old = parseReferences(JSON.parse(readFileSync(path, 'utf8')));
  if (!old) return next;
  const same = JSON.stringify({ ...old, generatedAt: '' }) === JSON.stringify({ ...next, generatedAt: '' });
  return same ? { ...next, generatedAt: old.generatedAt } : next;
}

/** Pretty JSON with one curve point per line, so a regenerated file reads well in a diff. */
function format(file: BenchReferences): string {
  const text = JSON.stringify(file, null, 2).replace(/\{\n\s+("generation"[^}]*?)\n\s+\}/g, (_m, body: string) => `{ ${body.replace(/,\n\s+/g, ', ')} }`);
  return `${text}\n`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const seeds = Number(args.seeds ?? 12);
  const firstSeed = Number(args['first-seed'] ?? 1);
  const generations = Number(args.generations ?? 100);
  const every = Number(args.every ?? 5);
  const population = Number(args.population ?? 100);
  const workers = Number(args.workers ?? 2);
  const out = args.out ?? 'public/references/racing.json';
  const keepGenomes = Boolean(args.raw);
  const tiers = args.tiers ? (args.tiers.split(',') as ReferenceCurve['tier'][]) : TIERS;
  const jobs = tiers.flatMap((tier) => Array.from({ length: seeds }, (_, i) => ({ tier, seed: firstSeed + i, generations, every, population, keepGenomes })));
  console.log(`Reference runs: ${tiers.length} tiers x ${seeds} seeds, ${generations} generations, population ${population}, ${workers} workers.`);
  const started = performance.now();
  const results = await runAll(jobs, workers, (r) =>
    console.log(`${r.job.tier} seed ${r.job.seed}: final ${r.scores[r.scores.length - 1].toFixed(1)} in ${r.seconds.toFixed(0)} s`),
  );
  const gens = checkpoints(generations, every);
  const references = tiers.map((tier) => {
    const runs = results.filter((r) => r.job.tier === tier).sort((a, b) => a.job.seed - b.job.seed);
    return summarizeCurve(tier, gens, runs.map((r) => r.scores));
  });
  const file = stableDate(out, {
    env: 'racing',
    benchmarkVersion: BENCHMARK_VERSION,
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    seeds,
    references,
  });
  writeFileSync(out, format(file));
  if (args.raw) writeFileSync(args.raw, JSON.stringify(results.map((r) => ({ ...r.job, scores: r.scores, genomes: r.genomes }))));
  for (const r of references) console.log(`${r.tier}: final median ${r.finalScore}`);
  console.log(`Wrote ${out} in ${((performance.now() - started) / 1000).toFixed(0)} s.`);
}

if (isMainThread) void main();
else serve();
