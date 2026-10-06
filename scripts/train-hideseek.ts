/**
 * Headless Hide and Seek co-evolution for long runs. Prints one line per
 * generation, and every few generations how long the current hiders stay
 * hidden against the scripted seeker. That second number is the fair
 * measure of hider skill: in co-evolution the seekers keep improving too,
 * so hidden time against them can stay flat while both teams get better.
 *
 *   npx tsx scripts/train-hideseek.ts --generations 200 --population 50 --workers 4
 *
 * Run it from the repo root. Options, all optional: --generations 200,
 * --population 50, --seed 1, --rounds 4, --workers (cores minus one, 0 runs
 * everything on the main thread), --bench-every 5, --save file.json (a
 * checkpoint written at the end), --resume file.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { mixSeed } from '../src/engine/core/rng';
import {
  createArenaPool,
  HideSeekTrainer,
  runMatch,
  scriptedSeekerController,
  STANDARD_HIDESEEK_INPUTS,
  type ArenaPool,
  type HideSeekGenerationStats,
  type MatchResult,
  type MatchSpec,
} from '../src/engine/hideseek';

/** One match to play. `scripted` swaps the seeker's brain for the scripted seeker. */
interface Job {
  spec: MatchSpec;
  scripted: boolean;
}

function play(job: Job, pool: ArenaPool): MatchResult {
  return runMatch(job.spec, pool, job.scripted ? { seeker: scriptedSeekerController } : {});
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
 * workers free up. Each worker loads this same file through tsx, because a
 * plain worker cannot resolve the engine's TypeScript imports.
 */
class Farm {
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

  close(): void {
    for (const w of this.workers) void w.terminate();
    this.local?.dispose();
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** Every current hider plays the scripted seeker once, on seeds that stay the same for the whole run. */
async function benchmark(trainer: HideSeekTrainer, farm: Farm): Promise<{ mean: number; best: number }> {
  const o = trainer.options;
  // The scripted seeker ignores its brain, but a match still needs one of the right shape.
  const stand = trainer.seekers.genomes[0];
  const jobs = trainer.hiders.genomes.map((genome, i) => ({
    scripted: true,
    spec: {
      layout: o.layouts[i % o.layouts.length],
      seed: mixSeed(o.seed, 0xbe7c, i),
      hider: { genome, inputs: o.hiderInputs },
      seeker: { genome: stand, inputs: o.seekerInputs },
      physics: o.physics,
      reward: o.reward,
    },
  }));
  const shares = (await farm.run(jobs)).map((r) => r.hiddenShare);
  return { mean: mean(shares), best: Math.max(...shares) };
}

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  return out;
}

function row(s: HideSeekGenerationStats, seconds: number): string {
  const g = s.game;
  const f = (v: number, d = 2) => v.toFixed(d).padStart(6);
  return (
    `${String(s.generation).padStart(4)} | hidden ${f(g.hiddenShare)} current ${f(g.currentHiddenShare)} | ` +
    `locks ${f(g.locksPerMatch)} moved ${f(g.boxesMovedPerMatch)} grabs ${f(g.grabsPerMatch)} | ` +
    `hider ${f(s.hiders.best, 1)} ${f(s.hiders.mean, 1)} seeker ${f(s.seekers.best, 1)} ${f(s.seekers.mean, 1)} | ` +
    `species ${s.hiders.species.length}/${s.seekers.species.length} | ${seconds.toFixed(1)} s`
  );
}

async function main(): Promise<void> {
  const args = parseArgs();
  const generations = Number(args.generations ?? 200);
  const benchEvery = Math.max(1, Number(args['bench-every'] ?? 5));
  const trainer = args.resume
    ? HideSeekTrainer.fromState(JSON.parse(readFileSync(args.resume, 'utf8')))
    : HideSeekTrainer.create({
        seed: Number(args.seed ?? 1),
        hiderInputs: STANDARD_HIDESEEK_INPUTS,
        seekerInputs: STANDARD_HIDESEEK_INPUTS,
        populationSize: Number(args.population ?? 50),
        rounds: Number(args.rounds ?? 4),
      });
  const farm = new Farm(Number(args.workers ?? Math.max(0, availableParallelism() - 1)));
  const o = trainer.options;
  console.log(`Hide and Seek co-evolution: ${o.populationSize} per team, ${o.rounds} rounds, layouts ${o.layouts.join(', ')}, seed ${o.seed}`);
  console.log('hidden: mean share of seek time the hider stayed hidden (all matches / current genomes only). Fitness: best and mean.');
  const baseline = await benchmark(trainer, farm);
  console.log(`bench at generation ${trainer.generation}: hiders hidden ${baseline.mean.toFixed(3)} (best ${baseline.best.toFixed(2)}) against the scripted seeker`);
  const first: HideSeekGenerationStats[] = [];
  let last = baseline;
  while (trainer.generation < generations) {
    const t0 = performance.now();
    const plan = trainer.planGeneration();
    const flat = await farm.run(plan.flat().map((spec) => ({ spec, scripted: false })));
    let k = 0;
    const stats = trainer.completeGeneration(plan.map((round) => round.map(() => flat[k++])));
    if (first.length < 5) first.push(stats);
    console.log(row(stats, (performance.now() - t0) / 1000));
    if (trainer.generation % benchEvery === 0) {
      last = await benchmark(trainer, farm);
      console.log(`bench at generation ${trainer.generation}: hiders hidden ${last.mean.toFixed(3)} (best ${last.best.toFixed(2)}) against the scripted seeker`);
    }
  }
  const recent = trainer.history.slice(-5);
  console.log(
    `Summary. Against the scripted seeker: ${baseline.mean.toFixed(3)} at the start, ${last.mean.toFixed(3)} now. ` +
      `Co-evolution hidden share: ${mean(first.map((s) => s.game.hiddenShare)).toFixed(3)} over the first 5 generations, ` +
      `${mean(recent.map((s) => s.game.hiddenShare)).toFixed(3)} over the last 5.`,
  );
  if (args.save) writeFileSync(args.save, JSON.stringify(trainer.toState()));
  farm.close();
}

if (isMainThread) void main();
else void serve();
